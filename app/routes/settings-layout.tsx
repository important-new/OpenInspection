import { Outlet } from "react-router";
import { PageHeader } from "@core/shared-ui";

export default function SettingsLayout() {
  return (
    <div>
      <PageHeader title="Settings" />
      <div className="mt-[18px] max-w-3xl">
        <Outlet />
      </div>
    </div>
  );
}
