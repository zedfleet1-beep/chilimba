@echo off
npx playwright-cli -s=chilimba open https://chilimba.zedfleet.com/login?next=/dashboard
npx playwright-cli -s=chilimba run-code --file=C:\Users\prince\WebstormProjects\chilimba\scripts\playwright-login-code.js
npx playwright-cli -s=chilimba close