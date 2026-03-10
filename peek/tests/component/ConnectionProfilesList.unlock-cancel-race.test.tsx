import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import ConnectionProfilesList from "../../src/components/ConnectionProfilesList";
import type { ConnectionProfile } from "../../src/types";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("ConnectionProfilesList unlock flow", () => {
  it("does not load a profile when unlock is canceled before async unlock resolves", async () => {
    const user = userEvent.setup();
    const unlockDeferred = deferred<boolean>();
    const onLoadProfile = vi.fn();
    const unlockProfile = vi.fn(() => unlockDeferred.promise);
    const profiles: ConnectionProfile[] = [
      {
        id: "p1",
        name: "Prod",
        encrypted: true,
        connection: { url: "https://prod.example.com", apiKey: "secret" },
      },
    ];

    render(
      <ConnectionProfilesList
        connectionProfiles={profiles}
        activeProfileId={null}
        onLoadProfile={onLoadProfile}
        onDeleteProfile={() => {}}
        onRenameProfile={() => {}}
        unlockProfile={unlockProfile}
      />,
    );

    await user.click(screen.getByTestId("profile-p1"));
    await user.type(screen.getByLabelText("Enter PIN"), "1234");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    unlockDeferred.resolve(true);
    await unlockDeferred.promise;
    await Promise.resolve();

    expect(onLoadProfile).not.toHaveBeenCalled();
  });

  it("ignores stale unlock results from earlier attempts on the same profile", async () => {
    const user = userEvent.setup();
    const firstUnlock = deferred<boolean>();
    const secondUnlock = deferred<boolean>();
    const onLoadProfile = vi.fn();
    const unlockProfile = vi
      .fn<(_: string, __: string) => Promise<boolean>>()
      .mockImplementationOnce(() => firstUnlock.promise)
      .mockImplementationOnce(() => secondUnlock.promise);
    const profiles: ConnectionProfile[] = [
      {
        id: "p1",
        name: "Prod",
        encrypted: true,
        connection: { url: "https://prod.example.com", apiKey: "secret" },
      },
    ];

    render(
      <ConnectionProfilesList
        connectionProfiles={profiles}
        activeProfileId={null}
        onLoadProfile={onLoadProfile}
        onDeleteProfile={() => {}}
        onRenameProfile={() => {}}
        unlockProfile={unlockProfile}
      />,
    );

    await user.click(screen.getByTestId("profile-p1"));
    await user.type(screen.getByLabelText("Enter PIN"), "1111");
    await user.click(screen.getByRole("button", { name: "Unlock" }));
    await user.clear(screen.getByLabelText("Enter PIN"));
    await user.type(screen.getByLabelText("Enter PIN"), "2222");
    await user.click(screen.getByRole("button", { name: "Unlock" }));

    firstUnlock.resolve(false);
    await firstUnlock.promise;
    await Promise.resolve();

    expect(screen.queryByText("Incorrect PIN")).not.toBeInTheDocument();
    expect(onLoadProfile).not.toHaveBeenCalled();

    secondUnlock.resolve(true);
    await secondUnlock.promise;
    await Promise.resolve();

    expect(onLoadProfile).toHaveBeenCalledWith("p1");
    expect(onLoadProfile).toHaveBeenCalledTimes(1);
  });
});
