# Corpus evaluation

Documents: 176 · readings: 480

## invoice

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | number | due | subtotal | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 83 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 79 | 100% | 97% | 97% | 95% | 100% | 96% | 94% | 92% | 99% | 100% | 100% | 81% |
| photo | 27 | 100% | 100% | 100% | 96% | 100% | 100% | 96% | 96% | 100% | 100% | 100% | 93% |
| office | 51 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| conditions | 90 | 92% | 83% | 89% | 93% | 82% | 78% | 77% | 68% | 78% | 89% | 73% | 53% |

## receipt

| source | n | type | vendor | date | currency | total | vat | items | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 10 | 100% | 100% | 100% | 100% | 100% | 90% | 90% | 80% | 80% |
| photo | 10 | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% | 100% |
| conditions | 45 | 89% | 78% | 82% | 89% | 91% | 87% | 80% | 76% | 73% |

## statement

| source | n | type | transaction count | amounts | dates | no false alarm | all fields |
| --- | --- | --- | --- | --- | --- | --- | --- |
| pdf | 16 | 100% | 100% | 100% | 100% | 100% | 100% |
| image | 16 | 100% | 100% | 94% | 100% | 94% | 94% |
| photo | 6 | 100% | 83% | 83% | 83% | 83% | 83% |
| conditions | 15 | 87% | 80% | 73% | 80% | 80% | 73% |

## report

| source | n | type | tables | net profit | checks | all fields |
| --- | --- | --- | --- | --- | --- | --- |
| pdf | 10 | 100% | 100% | 100% | 100% | 100% |

## reject

| source | n | type | all fields |
| --- | --- | --- | --- |
| pdf | 6 | 100% | 100% |
| image | 6 | 100% | 100% |

## Phone photo conditions

Invoices, receipts and a bank statement, each photographed under every condition.

| condition | n | all fields | total | date | vendor / transactions |
| --- | --- | --- | --- | --- | --- |
| dark | 10 | 90% | 100% | 100% | 100% |
| overexposed | 10 | 100% | 100% | 100% | 100% |
| flash | 10 | 50% | 60% | 100% | 100% |
| blur | 10 | 0% | 50% | 30% | 70% |
| shake | 10 | 0% | 0% | 0% | 40% |
| low-res | 10 | 30% | 90% | 80% | 80% |
| whatsapp | 10 | 100% | 100% | 100% | 100% |
| perspective | 10 | 100% | 100% | 100% | 100% |
| curled | 10 | 80% | 100% | 100% | 90% |
| upside-down | 10 | 90% | 100% | 100% | 90% |
| sideways | 10 | 10% | 100% | 100% | 10% |
| warm-light | 10 | 70% | 90% | 100% | 90% |
| hand-shadow | 10 | 20% | 70% | 80% | 60% |
| far-away | 10 | 90% | 100% | 100% | 90% |
| close-up | 10 | 90% | 100% | 100% | 100% |

## Failures

- **inv-en-US-classic** (image): date
  - date: got `"2026-02-18"`, want `"2026-02-13"`
- **inv-en-US-classic** (cond:blur): date, vat, items, no false alarm, number, subtotal
  - number: got `null`, want `"INV-2026-6610"`
  - date: got `"2026-02-27"`, want `"2026-02-13"`
  - subtotal: got `8980.69`, want `8312`
  - vat: got `[69]`, want `[737.69]`
  - items: got `[0,0,1.25,18,4500,12000,622500,831200]`, want `[18,45,54,120,600,1250,6225]`
  - failed checks: Line items add up; VAT matches its rate; Quantity × price per line
- **inv-en-US-classic** (cond:shake): type, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Harbor& Finch Supply Co. ) VOICE"`, want `"Harbor & Finch Supply Co."`
  - number: got `null`, want `"INV-2026-6610"`
  - date: got `null`, want `"2026-02-13"`
  - due: got `null`, want `"2026-02-27"`
  - currency: got `null`, want `"USD"`
  - subtotal: got `null`, want `8312`
  - total: got `null`, want `9049.69`
  - vat: got `[]`, want `[737.69]`
  - items: got `[8]`, want `[18,45,54,120,600,1250,6225]`
  - failed checks: Required fields
- **inv-en-US-classic** (cond:low-res): vat, items, no false alarm, number, due
  - number: got `null`, want `"INV-2026-6610"`
  - due: got `null`, want `"2026-02-27"`
  - vat: got `[737]`, want `[737.69]`
  - items: got `[18,45,54,120,225,600,7250]`, want `[18,45,54,120,600,1250,6225]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-en-US-classic** (cond:sideways): vendor, number
  - vendor: got `"Harbor & Finch Supply Go. INVUIVE"`, want `"Harbor & Finch Supply Co."`
  - number: got `null`, want `"INV-2026-6610"`
- **inv-en-US-classic** (cond:hand-shadow): total, no false alarm, subtotal
  - subtotal: got `null`, want `8312`
  - total: got `null`, want `9049.69`
  - failed checks: Required fields
- **inv-tr-discount** (image): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:flash): total, items, no false alarm, subtotal
  - subtotal: got `null`, want `5404.24`
  - total: got `null`, want `6485.09`
  - items: got `[-283.64,15,180,225,404.24,1079.88,1200,2988]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Required fields; Quantity × price per line
- **inv-tr-discount** (cond:blur): vendor, total, vat, items, no false alarm, number, subtotal
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - number: got `"F2020053808"`, want `"F2026053898"`
  - subtotal: got `540424`, want `5404.24`
  - total: got `6.48509`, want `6485.09`
  - vat: got `[1.08085]`, want `[1080.85]`
  - items: got `[1.07068,1.2,15,180,225,283.64,2988]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Line items add up; Subtotal + VAT = total; Quantity × price per line
- **inv-tr-discount** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Kizeyrizgan DarismanikAS CATURA"`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - number: got `null`, want `"F2026053898"`
  - date: got `null`, want `"2026-07-18"`
  - due: got `null`, want `"2026-08-17"`
  - currency: got `null`, want `"TRY"`
  - subtotal: got `null`, want `5404.24`
  - total: got `null`, want `6485.09`
  - vat: got `[]`, want `[1080.85]`
  - items: got `[]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Required fields
- **inv-tr-discount** (cond:low-res): vendor, vat, items, no false alarm, number, subtotal
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
  - number: got `"F2026053808"`, want `"F2026053898"`
  - subtotal: got `540424`, want `5404.24`
  - total: got `6485.08`, want `6485.09`
  - vat: got `[]`, want `[1080.85]`
  - items: got `[15,180,225,283.64,1079.88,1200,2988]`, want `[-283.64,15,180,225,1079.88,1200,2988]`
  - failed checks: Line items add up; Subtotal + VAT = total; Quantity × price per line
- **inv-tr-discount** (cond:curled): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:upside-down): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:sideways): vendor
  - vendor: got `"NULCyrUcgari Danismaniik A.9."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:warm-light): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-tr-discount** (cond:hand-shadow): vendor
  - vendor: got `"Kuzeyriizgan Danışmanlık A.Ş."`, want `"Kuzeyrüzgarı Danışmanlık A.Ş."`
- **inv-de-multi-vat** (cond:flash): no false alarm
  - failed checks: Line items add up
- **inv-de-multi-vat** (cond:blur): total, vat, no false alarm, due, subtotal
  - due: got `null`, want `"2026-08-10"`
  - subtotal: got `15.39478`, want `15394.78`
  - total: got `18.08221`, want `18082.21`
  - vat: got `[2548.05,13858,129686394]`, want `[138.58,2548.85]`
  - failed checks: Line items add up; Subtotal + VAT = total; Quantity × price per line
- **inv-de-multi-vat** (cond:shake): type, date, total, vat, items, no false alarm, number, due, subtotal
  - number: got `null`, want `"INV-2026-75819"`
  - date: got `null`, want `"2026-07-11"`
  - due: got `null`, want `"2026-08-10"`
  - subtotal: got `null`, want `15394.78`
  - total: got `null`, want `18082.21`
  - vat: got `[]`, want `[138.58,2548.85]`
  - items: got `[7]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Required fields
- **inv-de-multi-vat** (cond:low-res): vat, items, no false alarm, number, subtotal
  - number: got `null`, want `"INV-2026-75819"`
  - subtotal: got `15304.78`, want `15394.78`
  - vat: got `[2548.85]`, want `[138.58,2548.85]`
  - items: got `[90,99.98,225,600,1079.88,12500]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-de-multi-vat** (cond:sideways): vendor, no false alarm
  - vendor: got `null`, want `"Alpenblick Druck GmbH"`
  - failed checks: Required fields
- **inv-de-multi-vat** (cond:hand-shadow): type, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `15394.78`
  - vat: got `[]`, want `[138.58,2548.85]`
  - items: got `[90,138.58,225,600,899.9,1079.88,12500,15394.78]`, want `[90,225,600,899.9,1079.88,12500]`
  - failed checks: Line items add up
- **inv-de-multi-vat** (cond:far-away): vendor
  - vendor: got `"ET FF Sa EE EI SE AD"`, want `"Alpenblick Druck GmbH"`
- **inv-fr-modern** (cond:dark): number
  - number: got `null`, want `"RE-03753"`
- **inv-fr-modern** (cond:flash): total, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `2319.73`
  - total: got `null`, want `2783.68`
  - vat: got `[]`, want `[463.95]`
  - items: got `[0,12.9,64.5,112.5,179.98,269.97,600,1079.88]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Required fields
- **inv-fr-modern** (cond:blur): vat, items, no false alarm
  - vendor: got `"Boulangerie Lefévre SAS"`, want `"Boulangerie Lefèvre SAS"`
  - vat: got `[46305]`, want `[463.95]`
  - items: got `[112.5,179.08,600,1290,6450,20097,107968]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-fr-modern** (cond:shake): type, date, total, vat, items, no false alarm, number, due, subtotal
  - number: got `null`, want `"RE-03753"`
  - date: got `null`, want `"2026-07-04"`
  - due: got `null`, want `"2026-07-18"`
  - subtotal: got `null`, want `2319.73`
  - total: got `null`, want `2783.68`
  - vat: got `[]`, want `[463.95]`
  - items: got `[220,727,2155]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Required fields
- **inv-fr-modern** (cond:low-res): date, items, no false alarm, number, subtotal
  - number: got `null`, want `"RE-03753"`
  - date: got `"2026-07-18"`, want `"2026-07-04"`
  - subtotal: got `231073`, want `2319.73`
  - items: got `[12.9,64.5,112.5,179.08,269.97,600,1070.88]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-fr-modern** (cond:sideways): vendor, no false alarm
  - vendor: got `null`, want `"Boulangerie Lefèvre SAS"`
  - failed checks: Required fields
- **inv-fr-modern** (cond:warm-light): number
  - vendor: got `"Boulangerie Lefévre SAS"`, want `"Boulangerie Lefèvre SAS"`
  - number: got `null`, want `"RE-03753"`
- **inv-fr-modern** (cond:hand-shadow): total, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `2319.73`
  - total: got `null`, want `2783.68`
  - vat: got `[]`, want `[463.95]`
  - items: got `[12.9,64.5,112.5,179.98,269.97,600,1079.88,2319.73,2783.68]`, want `[12.9,64.5,112.5,179.98,269.97,600,1079.88]`
  - failed checks: Required fields
- **inv-fr-modern** (cond:close-up): number
  - number: got `null`, want `"RE-03753"`
- **inv-fr-multi-vat** (image): date
  - date: got `"2026-02-28"`, want `"2026-02-23"`
- **inv-es-classic** (image): vat, no false alarm
  - vat: got `[]`, want `[51.41]`
  - failed checks: Subtotal + VAT = total
- **inv-es-multi-vat** (image): vat, no false alarm
  - vat: got `[1634]`, want `[603.87,1634]`
  - failed checks: Subtotal + VAT = total; VAT matches its rate
- **inv-pl-classic** (cond:blur): date, currency, total, items, no false alarm, number, subtotal
  - vendor: got `"Drukarnia Wisniewski S.A."`, want `"Drukarnia Wiśniewski S.A."`
  - number: got `null`, want `"FV/54149/07/2026"`
  - date: got `"2006-07-19"`, want `"2026-07-19"`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `1380680`, want `1343.68`
  - total: got `1652`, want `1652.73`
  - items: got `[38.7,1125,17998]`, want `[38.7,179.98,1125]`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-pl-classic** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Niesie | PWSTZE"`, want `"Drukarnia Wiśniewski S.A."`
  - number: got `null`, want `"FV/54149/07/2026"`
  - date: got `null`, want `"2026-07-19"`
  - due: got `null`, want `"2026-08-18"`
  - currency: got `null`, want `"PLN"`
  - subtotal: got `null`, want `1343.68`
  - total: got `null`, want `1652.73`
  - vat: got `[]`, want `[309.05]`
  - items: got `[]`, want `[38.7,179.98,1125]`
  - failed checks: Required fields
- **inv-pl-classic** (cond:low-res): no false alarm, number, subtotal
  - number: got `null`, want `"FV/54149/07/2026"`
  - subtotal: got `1343.08`, want `1343.68`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate; Quantity × price per line
- **inv-pl-classic** (cond:curled): no false alarm, subtotal
  - subtotal: got `0`, want `1343.68`
  - failed checks: Line items add up; Subtotal + VAT = total; VAT matches its rate
- **inv-pl-classic** (cond:sideways): vendor
  - vendor: got `"rar 1a WIDINEWSKI S.A. VAI"`, want `"Drukarnia Wiśniewski S.A."`
- **inv-pl-classic** (cond:warm-light): currency, total, no false alarm, subtotal
  - currency: got `"EUR"`, want `"PLN"`
  - subtotal: got `0`, want `1343.68`
  - total: got `309.05`, want `1652.73`
  - failed checks: Line items add up; VAT matches its rate
- **inv-pl-classic** (cond:hand-shadow): total, vat
  - total: got `1343.68`, want `1652.73`
  - vat: got `[]`, want `[309.05]`
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
- **inv-es-leaders** (cond:flash): total, vat, items, no false alarm, subtotal
  - subtotal: got `null`, want `812.99`
  - total: got `null`, want `983.72`
  - vat: got `[]`, want `[170.73]`
  - items: got `[0,45,89.99,180,498,812.99,983.72]`, want `[45,89.99,180,498]`
  - failed checks: Required fields
- **inv-es-leaders** (cond:blur): date, vat, items, no false alarm, number, due, subtotal
  - number: got `"F2026043008"`, want `"F2026043698"`
  - date: got `"2026-08-09"`, want `"2026-06-09"`
  - due: got `null`, want `"2026-07-24"`
  - subtotal: got `null`, want `812.99`
  - vat: got `[]`, want `[170.73]`
  - items: got `[45,180,8099,49800,81299,934919407]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-es-leaders** (cond:shake): type, date, currency, total, vat, items, no false alarm, number, due, subtotal
  - vendor: got `"Graficas Romero SIL"`, want `"Gráficas Romero S.L."`
  - number: got `null`, want `"F2026043698"`
  - date: got `null`, want `"2026-06-09"`
  - due: got `null`, want `"2026-07-24"`
  - currency: got `null`, want `"EUR"`
  - subtotal: got `null`, want `812.99`
  - total: got `null`, want `983.72`
  - vat: got `[]`, want `[170.73]`
  - items: got `[]`, want `[45,89.99,180,498]`
  - failed checks: Required fields
- **inv-es-leaders** (cond:low-res): vat, items, no false alarm, number, due, subtotal
  - number: got `null`, want `"F2026043698"`
  - due: got `null`, want `"2026-07-24"`
  - subtotal: got `99`, want `812.99`
  - vat: got `[884.72]`, want `[170.73]`
  - items: got `[45,180,498,8999]`, want `[45,89.99,180,498]`
  - failed checks: Line items add up
- **inv-es-leaders** (cond:sideways): vendor
  - vendor: got `"varia nuinero S.L."`, want `"Gráficas Romero S.L."`
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
- **rcp-en-GB** (cond:blur): date, vat, items, no false alarm
  - vendor: got `"NORTHGATE ANALYTICSLIC"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[3.4]`
  - items: got `[]`, want `[5.5,9.9,28,28]`
  - failed checks: Required fields
- **rcp-en-GB** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm
  - vendor: got `"ETSESTS SECTS ST"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - currency: got `"JPY"`, want `"GBP"`
  - subtotal: got `null`, want `undefined`
  - total: got `null`, want `71.4`
  - vat: got `[]`, want `[3.4]`
  - items: got `[]`, want `[5.5,9.9,28,28]`
  - failed checks: Required fields
- **rcp-en-GB** (cond:sideways): vendor, items, no false alarm
  - vendor: got `"A4 copy paper (box) 5.50"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `68`, want `undefined`
  - items: got `[28,28]`, want `[5.5,9.9,28,28]`
  - failed checks: Line items add up
- **rcp-en-GB** (cond:hand-shadow): vendor, date, no false alarm
  - vendor: got `"NORTHGATE ICS LLC"`, want `"NORTHGATE ANALYTICS LLC"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-03-17"`
  - due: got `null`, want `undefined`
  - subtotal: got `68`, want `undefined`
  - failed checks: Required fields
- **rcp-tr** (cond:blur): type, vendor, date, currency, vat, items, no false alarm
  - vendor: got `"MANMARA TARILINA §"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-04-09"`
  - due: got `null`, want `undefined`
  - currency: got `"USD"`, want `"TRY"`
  - subtotal: got `null`, want `undefined`
  - vat: got `[]`, want `[0.93]`
  - items: got `[]`, want `[14,14,16.5,19.8,29.7]`
  - failed checks: Required fields
- **rcp-tr** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm
  - vendor: got `"SESNBSS. ITTTw 3 FT"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-04-09"`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"TRY"`
  - subtotal: got `null`, want `undefined`
  - total: got `null`, want `94`
  - vat: got `[]`, want `[0.93]`
  - items: got `[]`, want `[14,14,16.5,19.8,29.7]`
  - failed checks: Required fields
- **rcp-tr** (cond:sideways): vendor, items, no false alarm
  - vendor: got `"3 x A4 fotokopi kağıdı (ko 16,50"`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `93.07`, want `undefined`
  - items: got `[14,14,19.8]`, want `[14,14,16.5,19.8,29.7]`
  - failed checks: Line items add up
- **rcp-tr** (cond:hand-shadow): vendor
  - vendor: got `"MARMARA YAZI .8."`, want `"MARMARA YAZILIM A.Ş."`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `93.07`, want `undefined`
- **rcp-de** (cond:blur): type, date, currency, total, vat, items, no false alarm
  - vendor: got `"SCHNEIDER LOGISTIEAG"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - date: got `"2046-09-23"`, want `"2026-09-13"`
  - due: got `null`, want `undefined`
  - currency: got `null`, want `"EUR"`
  - subtotal: got `null`, want `undefined`
  - total: got `4320`, want `43.2`
  - vat: got `[]`, want `[2.83]`
  - items: got `[1,14,16.5,256]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Line items add up
- **rcp-de** (cond:shake): type, vendor, date, currency, total, vat, items, no false alarm
  - vendor: got `"Secraumpsso unter =F"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-09-13"`
  - due: got `null`, want `undefined`
  - currency: got `"GBP"`, want `"EUR"`
  - subtotal: got `null`, want `undefined`
  - total: got `null`, want `43.2`
  - vat: got `[]`, want `[2.83]`
  - items: got `[]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Required fields
- **rcp-de** (cond:sideways): vendor, items, no false alarm
  - vendor: got `"3 x Ergonomischer Biirostuh 7,20"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - due: got `null`, want `undefined`
  - subtotal: got `40.37`, want `undefined`
  - items: got `[5.5,16.5]`, want `[5.5,7.2,14,16.5]`
  - failed checks: Line items add up
- **rcp-de** (cond:hand-shadow): vendor, date, no false alarm
  - vendor: got `"SCHNEIDER LQ [K AG"`, want `"SCHNEIDER LOGISTIK AG"`
  - number: got `null`, want `undefined`
  - date: got `null`, want `"2026-09-13"`
  - due: got `null`, want `undefined`
  - subtotal: got `40.37`, want `undefined`
  - failed checks: Required fields
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
- **stm-tr-1** (cond:flash): amounts, no false alarm
  - amounts: got `[-825.57,764,968,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
- **stm-tr-1** (cond:blur): transaction count, amounts, dates
  - n: got `3`, want `9`
  - amounts: got `[968,60,400024]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
  - dates: got `["2020-05-07","2006-05-11","2026-05-15"]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-tr-1** (cond:shake): type, transaction count, amounts, dates, no false alarm
  - n: got `0`, want `9`
  - amounts: got `[]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
  - dates: got `[]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-tr-1** (cond:low-res): type, transaction count, amounts, dates, no false alarm
  - n: got `0`, want `9`
  - amounts: got `[]`, want `[-825.57,-1305.74,-363.51,-1729.09,8.73,-1566.69,1348.26,329.07,-162.59]`
  - dates: got `[]`, want `["2026-05-03","2026-05-05","2026-05-07","2026-05-08","2026-05-11","2026-05-12","2026-05-14","2026-05-15","2026-05-17"]`
- **stm-pl-1** (image): amounts, no false alarm
  - amounts: got `[-1642.4,-1030.31,686.03,-428399.5,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`, want `[-1642.4,-1030.31,-686.03,-311.62,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`
- **stm-pl-1** (photo): transaction count, amounts, dates, no false alarm
  - n: got `11`, want `12`
  - amounts: got `[-1642.4,-1030.31,686.03,311.62,688.55,-329855.86,-1313.05,-709.53,-315.95,-426.91,-2720.74]`, want `[-1642.4,-1030.31,-686.03,-311.62,-688.55,-784.81,-1313.05,-709.53,-315.95,-426.91,-973.57,-1747.17]`
  - dates: got `["2026-09-04","2026-09-05","2026-09-08","2026-09-10","2026-09-12","2026-09-13","2026-09-16","2026-09-17","2026-09-20","2026-09-22","2026-09-27"]`, want `["2026-09-04","2026-09-05","2026-09-08","2026-09-10","2026-09-12","2026-09-13","2026-09-16","2026-09-17","2026-09-20","2026-09-22","2026-09-24","2026-09-27"]`
