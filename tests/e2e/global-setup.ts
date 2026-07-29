import { assertPlaywrightEnvironment, configurePlaywrightEnvironment } from "./test-environment";

export default async function globalSetup() {
  configurePlaywrightEnvironment();
  assertPlaywrightEnvironment();
}
