# Corpus evaluation

Documents: 84 · readings: 194

## invoice

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | number | due | subtotal | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 52 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 52 | 100% | 96% | 100% | 90% | 98% | 92% | 100% | 92% | 94% | 92% | 100% | 71% |
| photo | 18 | 100% | 100% | 89% | 94% | 100% | 100% | 100% | 94% | 83% | 94% | 100% | 61% |

## receipt

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 10 | 100% | 100% | 100% | 90% | 100% | 100% | 100% | 100% | 90% |
| photo | 3 | 100% | 100% | 67% | 100% | 100% | 33% | 33% | 33% | 33% |

## statement

| source | n | type | transaction count | amounts | dates | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| photo | 5 | 100% | 80% | 80% | 80% | 80% | 80% |

## reject

| source | n | type | all fields |
| --- | --- | --- | --- |
| pdf | 6 | 100% | 100% |
| image | 6 | 100% | 100% |

## Failures

- **inv-en-US-classic** (photo): number, due
  - vendor: got `"Harbor & Finch Supply Co. NVOICE"`, want `"Harbor & Finch Supply Co."`
  - number: got `null`, want `"INV-2026-6610"`
  - due: got `null`, want `"2026-02-27"`
- **inv-en-US-multi-vat** (image): number
  - number: got `null`, want `"RE-91324"`
- **inv-en-US-discount** (photo): date
  - date: got `"2026-04-07"`, want `"2026-02-21"`
- **inv-en-GB-multi-vat** (photo): number
  - number: got `null`, want `"FV/33786/08/2026"`
- **inv-tr-modern** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-de-discount** (photo): date
  - date: got `"2026-03-12"`, want `"2026-02-26"`
- **inv-de-CH-multi-vat** (photo): number
  - number: got `null`, want `"F2026081639"`
- **inv-fr-discount** (image): number
  - vendor: got `"Boulangerie Lefevre SAS"`, want `"Boulangerie Lefèvre SAS"`
  - number: got `null`, want `"F2026083046"`
- **inv-nl-multi-vat** (image): vat, no false alarm
  - vat: got `[143.63]`, want `[143.63,333.89]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-pl-classic** (image): due
  - vendor: got `"Drukarnia Wisniewski S.A."`, want `"Drukarnia Wiśniewski S.A."`
  - due: got `null`, want `"2026-02-20"`
- **inv-pl-modern** (image): due
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0."`, want `"Kowalski Hurtownia Sp. z o.o."`
  - due: got `null`, want `"2026-07-08"`
- **inv-pl-multi-vat** (image): due
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0."`, want `"Kowalski Hurtownia Sp. z o.o."`
  - due: got `null`, want `"2026-03-12"`
- **inv-pl-multi-vat** (photo): no false alarm
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0-"`, want `"Kowalski Hurtownia Sp. z o.o."`
  - failed checks: Quantity × price per line
- **inv-pl-discount** (image): due
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0."`, want `"Kowalski Hurtownia Sp. z o.o."`
  - due: got `null`, want `"2026-05-17"`
- **inv-en-IN-classic** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (photo): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-multi-vat** (image): currency, total, vat, no false alarm
  - currency: got `null`, want `"INR"`
  - total: got `73500.65`, want `3500.65`
  - vat: got `[310.8,3518.62]`, want `[10.8,518.62]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-en-IN-discount** (image): currency, vat, no false alarm
  - currency: got `null`, want `"INR"`
  - vat: got `[725.43]`, want `[25.43]`
  - failed checks: Subtotal + VAT = total
- **inv-en-JP-modern** (image): number
  - number: got `null`, want `"RE-29038"`
- **inv-en-JP-multi-vat** (image): currency, vat, no false alarm
  - currency: got `null`, want `"JPY"`
  - vat: got `[8999]`, want `[432,8999]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **rcp-it** (photo): vat, items, no false alarm
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `41.8`, want `undefined`
  - vat: got `[4.1]`, want `[4.17]`
  - items: got `[3.9,4.8,11.4,19.8]`, want `[4.8,9.9,11.4,19.8]`
  - failed checks: Line items add up; VAT matches its rate
- **rcp-pl** (image): currency
  - vendor: got `"NOWAK SERWIS SP. Z 0.0."`, want `"NOWAK SERWIS SP. Z O.O."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `48.33`, want `undefined`
- **rcp-pl** (photo): date, vat, items, no false alarm
  - vendor: got `"NOWAK SERWIS SP. z 0.0"`, want `"NOWAK SERWIS SP. Z O.O."`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-07-16"`
  - due: got `null`, want `undefined`
  - subtotal: got `44.2`, want `undefined`
  - vat: got `[8]`, want `[3.87]`
  - items: got `[4]`, want `[5.5,9.9,11.4,11.4,14]`
  - failed checks: Required fields; Line items add up; Quantity × price per line
- **stm-fr-1** (photo): transaction count, amounts, dates, no false alarm
  - n: got `8`, want `9`
  - amounts: got `[1757.23,-1233.89,-475.15,1069.25,-521.69,480.77,-1649.91,-471.83]`, want `[1757.23,-1233.89,-475.15,1069.25,-521.69,-1383.2,-480.77,-1649.91,-471.83]`
  - dates: got `["2026-01-03","2026-01-05","2026-01-08","2026-01-10","2026-01-12","2026-01-17","2026-01-19","2026-01-20"]`, want `["2026-01-03","2026-01-05","2026-01-08","2026-01-10","2026-01-12","2026-01-14","2026-01-17","2026-01-19","2026-01-20"]`
