import { describe, expect, it } from "vitest";

import { parseHotThreadsText } from "../../src/utils/parseHotThreads";

describe("parseHotThreadsText", () => {
  it("parses node/sample/thread info from hot threads text", () => {
    const input = [
      "::: {node-a}{id1}{ephemeral}{host-a}{127.0.0.1}{127.0.0.1:9300}{cdfhilmrstw}",
      "  92.0% (460ms out of 500ms) cpu usage by thread 'elasticsearch[node-a][search][T#3]'",
      "    10/10 snapshots sharing following 1 elements",
      "      org.elasticsearch.search.SearchService.executeQueryPhase(SearchService.java:123)",
      "::: {node-b}{id2}{ephemeral}{host-b}{127.0.0.2}{127.0.0.2:9300}{cdfhilmrstw}",
      "  55.0% (275ms out of 500ms) wait usage by thread 'elasticsearch[node-b][management][T#1]'",
      "    8/10 snapshots sharing following 1 elements",
      "      java.lang.Object.wait(Native Method)",
    ].join("\n");

    const parsed = parseHotThreadsText(input);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      node: "node-a",
      sampleType: "cpu",
      sampleValue: 92,
      sampleUnit: "%",
      threadName: "elasticsearch[node-a][search][T#3]",
    });
    expect(parsed[0]?.stackFrames).toContain(
      "org.elasticsearch.search.SearchService.executeQueryPhase(SearchService.java:123)",
    );
    expect(parsed[1]).toMatchObject({
      node: "node-b",
      sampleType: "wait",
      sampleValue: 55,
      sampleUnit: "%",
      threadName: "elasticsearch[node-b][management][T#1]",
    });
  });

  it("parses newer sample format with cpu/other bracket segment", () => {
    const input = [
      "::: {instance-0000000001}{DxGGHr7iRyKn-YSDrkWQzA}",
      "   Hot threads at 2026-03-07T03:38:25.091Z, interval=500ms, busiestThreads=3, ignoreIdleThreads=true:",
      "    0.2% [cpu=0.2%, other=0.0%] (781.6micros out of 500ms) cpu usage by thread 'elastic-apm-server-reporter'",
      "     10/10 snapshots sharing following 10 elements",
      "       java.base@25.0.1/jdk.internal.misc.Unsafe.park(Native Method)",
    ].join("\n");

    const parsed = parseHotThreadsText(input);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      node: "instance-0000000001",
      sampleType: "cpu",
      sampleValue: 0.2,
      sampleUnit: "%",
      sampleWindow: "781.6micros out of 500ms",
      threadName: "elastic-apm-server-reporter",
      snapshotSummary: "10/10 snapshots sharing following 10 elements",
      topFrame: "java.base@25.0.1/jdk.internal.misc.Unsafe.park(Native Method)",
    });
    expect(parsed[0]?.stackFrames).toHaveLength(1);
  });

  it("parses memory allocation sample format", () => {
    const input = [
      "::: {instance-0000000000}{UwXVniD0QqWWehirrsqzxw}",
      "   Hot threads at 2026-03-07T03:52:13.202Z, interval=500ms, busiestThreads=10, ignoreIdleThreads=true:",
      "   11.4kb memory allocated by thread 'elasticsearch[instance-0000000000][transport_worker][T#2]'",
      "     unique snapshot",
      "       java.base@25.0.1/com.sun.crypto.provider.GHASH.update(GHASH.java:197)",
    ].join("\n");

    const parsed = parseHotThreadsText(input);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({
      node: "instance-0000000000",
      sampleType: "mem",
      sampleValue: 11.4,
      sampleUnit: "kb",
      sampleWindow: "allocated",
      snapshotSummary: "unique snapshot",
      threadName: "elasticsearch[instance-0000000000][transport_worker][T#2]",
      topFrame: "java.base@25.0.1/com.sun.crypto.provider.GHASH.update(GHASH.java:197)",
    });
  });
});
