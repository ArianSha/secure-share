export type TunnelState = {
  status: "stopped" | "starting" | "running" | "stopping" | "error";
  url: string | null;
  error: string | null;
};

export const stoppedTunnel: TunnelState = {
  status: "stopped",
  url: null,
  error: null,
};
