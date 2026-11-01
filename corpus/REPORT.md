# Corpus evaluation

Documents: 176 · readings: 330

## invoice

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | number | due | subtotal | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 83 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 79 | 100% | 97% | 97% | 95% | 100% | 96% | 94% | 92% | 99% | 100% | 100% | 81% |
| photo | 27 | 100% | 100% | 100% | 96% | 100% | 100% | 96% | 96% | 100% | 100% | 100% | 93% |
| office | 51 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## receipt

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 10 | 100% | 100% | 100% | 100% | 100% | 90% | 90% | 80% | 80% |
| photo | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |

## statement

| source | n | type | transaction count | amounts | dates | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 16 | 100% | 100% | 94% | 100% | 94% | 94% |
| photo | 6 | 100% | 83% | 83% | 83% | 83% | 83% |

## report

| source | n | type | tables | net profit | checks | all fields |
| --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% |

## reject

| source | n | type | all fields |
| --- | --- | --- | --- |
| pdf | 6 | 100% | 100% |
| image | 6 | 100% | 100% |

## Failures

- **inv-en-US-classic** (image): date
  - date: got `"2026-02-18"`, want `"2026-02-13"`
- **inv-tr-discount** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-fr-multi-vat** (image): date
  - date: got `"2026-02-28"`, want `"2026-02-23"`
- **inv-es-classic** (image): vat, no false alarm
  - vat: got `[]`, want `[51.41]`
  - failed checks: Subtotal + VAT = total
- **inv-es-multi-vat** (image): vat, no false alarm
  - vat: got `[1634]`, want `[603.87,1634]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-en-IN-classic** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (photo): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-multi-vat** (image): currency, vat, no false alarm, number
  - number: got `null`, want `"INV-2026-31631"`
  - currency: got `null`, want `"INR"`
  - vat: got `[710.8,31142.91]`, want `[10.8,1142.91]`
  - failed checks: Subtotal + VAT = total
- **inv-en-IN-discount** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-GB-leaders** (image): items
  - items: got `[89.99,450,1125,1290,31250]`, want `[89.99,90,450,1125,1200,31250]`
- **inv-tr-leaders** (image): items, no false alarm
  - vendor: got `"Ege Kirtasiye Ltd. Sti."`, want `"Ege Kırtasiye Ltd. Şti."`
  - items: got `[22.5,94,120,216,249,322.5]`, want `[22.5,54,120,216,249,322.5,747]`
  - failed checks: Line items add up
- **inv-es-leaders** (image): items, no false alarm
  - items: got `[49,89.99,180,498]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-it-leaders** (image): items
  - items: got `[0,36,45,6825]`, want `[36,45,600,6225]`
- **inv-it-leaders** (photo): items, no false alarm
  - items: got `[36,46,600,6225]`, want `[36,45,600,6225]`
  - failed checks: Line items add up
- **inv-pt-leaders** (image): items, no false alarm
  - items: got `[12.9,89.99,179.98,600,1079.88,32190]`, want `[12.9,89.99,179.98,600,1079.88,3750]`
  - failed checks: Line items add up
- **inv-pl-credit** (image): vendor
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0. KORYGUJACA"`, want `"Kowalski Hurtownia Sp. z o.o."`
- **rcp-pl** (image): items, no false alarm
  - vendor: got `"DRUKARNIA WISNIEWSKI S.A."`, want `"DRUKARNIA WIŚNIEWSKI S.A."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `7.31`, want `undefined`
  - items: got `[2.4,5750]`, want `[2.4,5.5]`
  - failed checks: Line items add up
- **rcp-en-JP** (image): vat, no false alarm
  - number: got `"6877"`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `1517`, want `undefined`
  - vat: got `[123]`, want `[121]`
  - failed checks: VAT matches its rate
- **stm-pl-1** (image): amounts, no false alarm
  - amounts: got `[-1642.4,-1030.31,686.03,-428399.5,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`, want `[-1642.4,-1030.31,-686.03,-311.62,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`
- **stm-pl-1** (photo): transaction count, amounts, dates, no false alarm
  - n: got `11`, want `12`
  - amounts: got `[-1642.4,-1030.31,686.03,311.62,688.55,-329855.86,-1313.05,-709.53,-315.95,-426.91,-2720.74]`, want `[-1642.4,-1030.31,-686.03,-311.62,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`
  - dates: got `["2026-09-04","2026-09-05","2026-09-08","2026-09-10","2026-09-12","2026-09-13","2026-09-16","2026-09-17","2026-09-20","2026-09-22","2026-09-27"]`, want `["2026-09-04","2026-09-05","2026-09-08","2026-09-10","2026-09-12","2026-09-13","2026-09-16","2026-09-17","2026-09-20","2026-09-22","2026-09-24","2026-09-27"]`
