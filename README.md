# BIISMO REG

BIISMO REG is a UK vehicle checker built with Node.js, Express and browser-native JavaScript. It combines official DVLA vehicle-enquiry data with DVSA MOT history and presents tax, MOT, mileage, emissions and vehicle details in a mobile-friendly report.

## Features

- Official DVLA vehicle and tax details
- DVSA MOT history, mileage and defect grouping
- Calculated mileage trends and a clearly labelled ULEZ estimate
- Printable reports and installable web-app groundwork
- Registration validation, upstream timeouts and API rate limiting
- Server-side API credentials with no token or vehicle-response logging

## Requirements

- Node.js 18.17 or newer
- DVLA Vehicle Enquiry API credentials
- DVSA MOT History API credentials

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env` and enter the API credentials.
3. Run `npm start`.
4. Open `http://localhost:3000`.

Do not commit `.env`; it is ignored by Git.

## Tests

Run `npm test`.

## Data accuracy

Vehicle, tax and MOT records come from the configured government APIs. ULEZ and mileage insights are calculated estimates and should be independently confirmed before making travel or purchasing decisions.
