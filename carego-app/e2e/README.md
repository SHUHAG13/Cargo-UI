# Browser tests

Drive the built app in a real Chrome with `puppeteer-core`.

```bash
npm run build:dev     # builds to dist/ (the tests serve it themselves)
npm run e2e:smoke     # every route as every role: no console errors, no broken images, guards redirect
npm run e2e:flow      # the whole business flow: register → KYC → book → admin confirms → pay → assign → shift → cash → earnings
```

Set `CHROME_PATH` if Chrome is not in a standard location. Tests use a fresh browser profile, so they never touch your data.
