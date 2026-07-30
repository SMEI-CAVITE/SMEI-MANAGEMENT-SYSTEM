// @ts-ignore
import appModule from "../dist/server.cjs";

const app = appModule.default || appModule.app || appModule;

export default app;