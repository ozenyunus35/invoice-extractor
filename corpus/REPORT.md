# Corpus evaluation

Documents: 125 · readings: 279

## invoice

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | number | due | subtotal | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 83 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 79 | 100% | 97% | 99% | 94% | 99% | 96% | 95% | 90% | 100% | 100% | 100% | 82% |
| photo | 27 | 100% | 100% | 96% | 96% | 93% | 93% | 100% | 89% | 89% | 96% | 100% | 74% |

## receipt

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 10 | 100% | 100% | 100% | 80% | 100% | 100% | 100% | 90% | 80% |
| photo | 10 | 100% | 100% | 80% | 90% | 100% | 70% | 40% | 60% | 40% |

## statement

| source | n | type | transaction count | amounts | dates | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| photo | 6 | 100% | 100% | 83% | 100% | 83% | 83% |

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

- **inv-en-US-classic** (photo): number, due
  - vendor: got `"Harbor & Finch Supply Co. NVOICE"`, want `"Harbor & Finch Supply Co."`
  - number: got `null`, want `"INV-2026-6610"`
  - due: got `null`, want `"2026-02-27"`
- **inv-tr-discount** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-de-discount** (photo): date
  - date: got `"2026-04-10"`, want `"2026-02-24"`
- **inv-de-CH-multi-vat** (photo): vat, no false alarm
  - vat: got `[7.29]`, want `[1.52,7.29]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-fr-multi-vat** (image): date
  - date: got `"2026-02-28"`, want `"2026-02-23"`
- **inv-pl-multi-vat** (photo): total, vat, no false alarm
  - vendor: got `"Nowak Serwis Sp. z 0.0."`, want `"Nowak Serwis Sp. z o.o."`
  - total: got `1479506.8`, want `7877.9`
  - vat: got `[1473102]`, want `[1473.1]`
  - failed checks: VAT matches its rate
- **inv-en-IN-classic** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-IN-modern** (image): currency, total, vat, no false alarm
  - currency: got `null`, want `"INR"`
  - total: got `7138.06`, want `138.06`
  - vat: got `[321.06]`, want `[21.06]`
  - failed checks: Subtotal + VAT = total
- **inv-en-IN-modern** (photo): currency, total, no false alarm
  - currency: got `null`, want `"INR"`
  - total: got `6`, want `138.06`
  - failed checks: Subtotal + VAT = total
- **inv-en-IN-multi-vat** (image): currency, vat, no false alarm
  - currency: got `null`, want `"INR"`
  - vat: got `[310.8,71142.91]`, want `[10.8,1142.91]`
  - failed checks: Subtotal + VAT = total
- **inv-en-IN-discount** (image): currency
  - currency: got `null`, want `"INR"`
- **inv-en-JP-multi-vat** (image): currency
  - currency: got `null`, want `"JPY"`
- **inv-en-GB-leaders** (image): items, no false alarm
  - items: got `[7,90,450,1125,1200,31250]`, want `[89.99,90,450,1125,1200,31250]`
  - failed checks: Line items add up
- **inv-en-GB-leaders** (photo): number
  - number: got `"FW88674/02/2026"`, want `"FV/88674/02/2026"`
- **inv-tr-leaders** (image): no false alarm
  - vendor: got `"Ege Kirtasiye Ltd. Sti."`, want `"Ege Kırtasiye Ltd. Şti."`
  - failed checks: Quantity × price per line
- **inv-fr-leaders** (image): items, no false alarm
  - items: got `[9,249,249,770,15000]`, want `[9,249,249,249,15000]`
  - failed checks: Line items add up
- **inv-it-leaders** (image): items, no false alarm
  - items: got `[45,86,600]`, want `[36,45,600,6225]`
  - failed checks: Line items add up
- **inv-nl-credit** (image): vat, no false alarm
  - vendor: got `"Van Dijk Kantoorartikelen B.V. CREDITNOTA"`, want `"Van Dijk Kantoorartikelen B.V."`
  - vat: got `[]`, want `[-383.04]`
  - failed checks: Subtotal + VAT = total
- **inv-pt-leaders** (photo): number
  - number: got `null`, want `"FV/56840/05/2026"`
- **inv-pl-credit** (image): vendor
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0. KORYGUJACA"`, want `"Kowalski Hurtownia Sp. z o.o."`
- **inv-pl-leaders** (image): items, no false alarm
  - vendor: got `"Nowak Serwis Sp. z 0.0."`, want `"Nowak Serwis Sp. z o.o."`
  - items: got `[0,18]`, want `[18,89.99,90]`
  - failed checks: Line items add up
- **rcp-en-GB** (photo): date, vat, items, no false alarm
  - number: got `"96142"`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[3.4]`
  - items: got `[]`, want `[5.5,9.9,28,28]`
  - failed checks: Required fields
- **rcp-tr** (photo): vat, items
  - vendor: got `"MARMARA YAZILIM A.Ş"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `80`, want `undefined`
  - vat: got `[14]`, want `[0.93]`
  - items: got `[]`, want `[14,14,16.5,19.8,29.7]`
- **rcp-de** (photo): items, no false alarm
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `40.37`, want `undefined`
  - items: got `[1.2,5.5,14,16]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Line items add up
- **rcp-it** (photo): items, no false alarm
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `44`, want `undefined`
  - items: got `[4.8,5,14,16]`, want `[4.8,5.5,7.6,14,16.5]`
  - failed checks: Line items add up
- **rcp-nl** (photo): date, items, no false alarm
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-01-14"`
  - due: got `null`, want `undefined`
  - subtotal: got `24.77`, want `undefined`
  - items: got `[2.4,4.8,9.9]`, want `[2.4,4.8,9.9,9.9]`
  - failed checks: Required fields; Line items add up
- **rcp-pl** (image): currency
  - vendor: got `"DRUKARNIA WISNIEWSKI S.A."`, want `"DRUKARNIA WIŚNIEWSKI S.A."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `7.31`, want `undefined`
- **rcp-pl** (photo): currency, vat, items
  - vendor: got `"DRUKARNIA WISNIEWSKI S.A"`, want `"DRUKARNIA WIŚNIEWSKI S.A."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `-51.1`, want `undefined`
  - vat: got `[59]`, want `[0.59]`
  - items: got `[]`, want `[2.4,5.5]`
- **rcp-en-JP** (image): currency, no false alarm
  - number: got `"6877"`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"JPY"`
  - subtotal: got `1519`, want `undefined`
  - failed checks: VAT matches its rate
- **stm-fr-0** (photo): amounts, no false alarm
  - amounts: got `[874.94,-1479.07,-1481.52,-868,-1470.54,-1742.49,11225.96,711.29,562.92,395.77,1205.48,15318.71]`, want `[874.94,-1479.07,-1481.52,-868,-1470.54,-1742.49,-1416.2,-711.29,562.92,395.77,-1205.48,-760.39]`
