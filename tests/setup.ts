import { configure } from "@testing-library/dom";

// Coverage instrumentation and cold lazy-route imports can exceed the 1s default.
configure({ asyncUtilTimeout: 3000 });
