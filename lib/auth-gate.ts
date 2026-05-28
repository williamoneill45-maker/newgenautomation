export const authCookieName = "newgen_auth";

export const authSessionValue =
  process.env.AUTH_SESSION_VALUE ??
  "f4bb37247a2898f5514c8e90a70f1df7ce4e43373c8dae34cf47236244f016cb";

export const authUsername = process.env.AUTH_USERNAME ?? "admin";

export const authPasswordHash =
  process.env.AUTH_PASSWORD_SHA256 ??
  "16696042c3ae90028127a60b0cf1089ed908dba815f673adc9357c6eeacb4264";

