import { ConfigContext } from "expo/config";

export default ({ config }: ConfigContext) => ({
  ...config,
  extra: { ...config.extra, backendUrl: process.env.EXPO_PUBLIC_BACKEND_URL },
});