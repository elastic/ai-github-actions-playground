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
});
