# Corpus evaluation

Documents: 125 · readings: 272

## invoice

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | number | due | subtotal | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 83 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 79 | 100% | 97% | 99% | 94% | 99% | 96% | 95% | 90% | 92% | 92% | 100% | 72% |
| photo | 27 | 100% | 100% | 96% | 96% | 93% | 93% | 100% | 89% | 89% | 93% | 100% | 70% |

## receipt

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 10 | 100% | 100% | 100% | 80% | 100% | 100% | 100% | 90% | 80% |
| photo | 3 | 100% | 100% | 100% | 67% | 100% | 33% | 0% | 67% | 0% |

## statement

| source | n | type | transaction count | amounts | dates | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| photo | 6 | 100% | 100% | 100% | 100% | 100% | 100% |

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
- **inv-en-GB-multi-vat** (image): number
  - number: got `null`, want `"RE-16548"`
- **inv-tr-discount** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-de-discount** (photo): date
  - date: got `"2026-04-10"`, want `"2026-02-24"`
- **inv-de-CH-multi-vat** (photo): vat, no false alarm
  - vat: got `[7.29]`, want `[1.52,7.29]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-fr-classic** (image): number
  - vendor: got `"Boulangerie Lefevre SAS"`, want `"Boulangerie Lefèvre SAS"`
  - number: got `null`, want `"F2026094077"`
- **inv-fr-multi-vat** (image): date
  - date: got `"2026-02-28"`, want `"2026-02-23"`
- **inv-it-discount** (image): number
  - number: got `null`, want `"INV-2026-52987"`
- **inv-pl-classic** (image): due
  - vendor: got `"Drukarnia Wisniewski S.A."`, want `"Drukarnia Wiśniewski S.A."`
  - due: got `null`, want `"2026-08-18"`
- **inv-pl-modern** (image): due
  - vendor: got `"Nowak Serwis Sp. z 0.0."`, want `"Nowak Serwis Sp. z o.o."`
  - due: got `null`, want `"2026-05-17"`
- **inv-pl-multi-vat** (image): due
  - vendor: got `"Nowak Serwis Sp. z 0.0."`, want `"Nowak Serwis Sp. z o.o."`
  - due: got `null`, want `"2026-02-07"`
- **inv-pl-multi-vat** (photo): total, vat, no false alarm
  - vendor: got `"Nowak Serwis Sp. z 0.0."`, want `"Nowak Serwis Sp. z o.o."`
  - total: got `1479506.8`, want `7877.9`
  - vat: got `[1473102]`, want `[1473.1]`
  - failed checks: VAT matches its rate
- **inv-pl-discount** (image): due
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0."`, want `"Kowalski Hurtownia Sp. z o.o."`
  - due: got `null`, want `"2026-02-15"`
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
- **inv-en-IN-discount** (image): currency, number
  - number: got `null`, want `"F2026058917"`
  - currency: got `null`, want `"INR"`
- **inv-en-JP-multi-vat** (image): currency
  - currency: got `null`, want `"JPY"`
- **inv-en-JP-discount** (image): number
  - number: got `null`, want `"RE-36438"`
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
- **inv-it-leaders** (image): items, no false alarm, number
  - number: got `null`, want `"FV/33194/07/2026"`
  - items: got `[45,86,600]`, want `[36,45,600,6225]`
  - failed checks: Line items add up
- **inv-nl-credit** (image): vat, no false alarm
  - vendor: got `"Van Dijk Kantoorartikelen B.V. CREDITNOTA"`, want `"Van Dijk Kantoorartikelen B.V."`
  - vat: got `[]`, want `[-383.04]`
  - failed checks: Subtotal + VAT = total
- **inv-pt-leaders** (photo): number
  - number: got `null`, want `"FV/56840/05/2026"`
- **inv-pl-credit** (image): vendor, due
  - vendor: got `"Kowalski Hurtownia Sp. z 0.0. KORYGUJACA"`, want `"Kowalski Hurtownia Sp. z o.o."`
  - due: got `null`, want `"2026-01-31"`
- **inv-pl-leaders** (image): items, no false alarm, due
  - vendor: got `"Nowak Serwis Sp. z 0.0."`, want `"Nowak Serwis Sp. z o.o."`
  - due: got `null`, want `"2026-07-24"`
  - items: got `[0,18]`, want `[18,89.99,90]`
  - failed checks: Line items add up
- **inv-pl-leaders** (photo): due
  - vendor: got `"Nowak Serwis Sp.z o.o."`, want `"Nowak Serwis Sp. z o.o."`
  - due: got `null`, want `"2026-07-24"`
- **rcp-tr** (photo): vat, items
  - vendor: got `"MARMARA YAZILIM A.Ş"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[0.93]`
  - items: got `[]`, want `[14,14,16.5,19.8,29.7]`
- **rcp-es** (photo): currency, vat, items
  - vendor: got `"GRÁFICAS ROMERO S.L"`, want `"GRÁFICAS ROMERO S.L."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"EUR"`
  - subtotal: got `69`, want `undefined`
  - vat: got `[1]`, want `[6.36]`
  - items: got `[]`, want `[28,42]`
- **rcp-pt** (photo): items, no false alarm
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `33.58`, want `undefined`
  - items: got `[4.8,5,5.5,19.8]`, want `[4.8,5.5,5.5,19.8]`
  - failed checks: Line items add up
- **rcp-pl** (image): currency
  - vendor: got `"DRUKARNIA WISNIEWSKI S.A."`, want `"DRUKARNIA WIŚNIEWSKI S.A."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `7.31`, want `undefined`
- **rcp-en-JP** (image): currency, no false alarm
  - number: got `"6877"`, want `undefined`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"JPY"`
  - subtotal: got `1519`, want `undefined`
  - failed checks: VAT matches its rate
