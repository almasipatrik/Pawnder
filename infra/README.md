# Pawnder AWS Infrastruktúra (CDK)

Ez a mappa tartalmazza a Pawnder éles AWS felhőinfrastruktúráját, amely **AWS CDK (TypeScript)** segítségével kezeli a teljes rendszert a lehető legköltséghatékonyabb, fix áras felépítésben.

---

## 🏗️ Architektúra áttekintés

```
                                  [ Rackhost DNS ]
                                   pawnder.hu
                                  /          \
                       (CNAME)   /            \  (A-rekord)
                                v              v
                    [ CloudFront CDN ]    [ AWS Lightsail VPS ]
                    (Ingyenes ACM SSL)    (Fix IP: api.pawnder.hu)
                            |                      |
                            v                      v
                    [ S3 Privát Bucket ]   [ Docker Compose ]
                    Next.js 'output:export'  ├── Caddy (Auto SSL)
                    (HTML, JS, CSS, Képek)   ├── NestJS Backend API
                                             ├── PostgreSQL 17 DB
                                             └── Scraper Worker
```

### 💰 Havi üzemeltetési költség:
- **Frontend (S3 + CloudFront CDN):** ~**$0.00 – $0.20 / hó** (örök ingyenes kvótán belül)
- **SSL Tanúsítvány (AWS ACM Wildcard):** **$0.00** (ingyenes)
- **Backend + Adatbázis + Scraper (AWS Lightsail VPS `micro_3_0`):** **$5.00 / hó (~1 900 Ft)**
- **Összesen:** **kb. $5.00 / hó (fix, kiszámítható költség, nincs meglepetés számla)**

---

## 🚀 Üzembe helyezési lépések (Step-by-Step)

### 0. Előfeltételek
Győződj meg róla, hogy az AWS CLI be van állítva a gépeden:
```bash
aws configure
# Add meg az AWS Access Key ID, Secret Access Key és az alapértelmezett régiót (pl. eu-central-1)
```

Telepítsd az infra csomagokat:
```bash
cd infra
npm install
```

---

### 1. Lépés: SSL Tanúsítvány igénylése (`us-east-1`)

A CloudFront kizárólag a `us-east-1` (Észak-Virginia) régióban lévő ACM tanúsítványokat fogadja el:

```bash
npm run deploy:cert
```

A parancs lefutása után a terminálban és a CloudFormation konzolon megjelenik a **DNS validációs CNAME rekord**:
- **Rekord típus:** `CNAME`
- **Név:** `_xxxxxxxx.pawnder.hu.`
- **Érték:** `_yyyyyyyy.acm-validations.aws.`

> **Rackhost feladat:** Lépj be a [rackhost.hu](https://www.rackhost.hu) DNS kezelőjébe, és add hozzá ezt a CNAME rekordot a `pawnder.hu` zónához. Az AWS pár percen belül automatikusan ellenőrzi és kiállítja a tanúsítványt!

---

### 2. Lépés: A Fő Infrastruktúra kiépítése (S3 + CloudFront + Lightsail)

Miután a tanúsítvány állapota `Issued` (Kiadva) lett az AWS konzolon:

```bash
# Másold ki a tanúsítvány ARN-jét az előző lépésből, vagy add meg context-ként:
npx cdk deploy PawnderInfraStack -c certificateArn="arn:aws:acm:us-east-1:123456789012:certificate/xxxxxxxx"
```

A CDK kiépíti:
1. A privát, titkosított **S3 bucketet** a frontendnek.
2. A globális **CloudFront CDN-t** a te domaineddel (`pawnder.hu` és `www.pawnder.hu`).
3. Az **AWS Lightsail Ubuntu 24.04 VPS-t** (Frankfurtban), telepített Dockerrel, 2GB Swap memóriával és nyitott 22, 80, 443-as portokkal.
4. A VPS-hez rendelt **fix, statikus nyilvános IP címet**.

A lefutás végén a terminál kiírja az eredményeket:
- `CloudFrontDomainName`: pl. `d123456abcdef.cloudfront.net`
- `LightsailStaticIpAddress`: pl. `3.120.xx.xx`

---

### 3. Lépés: Végleges DNS beállítás a Rackhostban

A Rackhost DNS kezelőjében mindössze az alábbi rekordokat kell felvenned:

| Név | Típus | Érték | Cél |
| :--- | :--- | :--- | :--- |
| `pawnder.hu` | **CNAME / ALIAS** | `d123456abcdef.cloudfront.net` | Főoldal (CloudFront CDN) |
| `www.pawnder.hu` | **CNAME** | `d123456abcdef.cloudfront.net` | WWW átirányítás |
| `api.pawnder.hu` | **A** | `3.120.xx.xx` *(a Lightsail fix IP-d)* | Backend REST API & Caddy |

---

### 4. Lépés: Frontend feltöltése (Deploy)

A frontend mappa Next.js kódját statikusan buildeljük, majd feltöltjük az S3 bucketbe:

```bash
# 1. Frontend buildelése
cd ../frontend
npm run build

# 2. Fájlok szinkronizálása az S3 bucketbe
aws s3 sync out/ s3://pawnder-frontend-FIÓKID-eu-central-1 --delete

# 3. CloudFront gyorsítótár ürítése (hogy azonnal látszódjanak a frissítések)
aws cloudfront create-invalidation --distribution-id TE_DISTRIBUTION_IDOD --paths "/*"
```

---

### 5. Lépés: Backend és Adatbázis indítása a Lightsail VPS-en

A Lightsail szerverre SSH-val belépve (akár az AWS böngészős konzolból, akár sima SSH kulccsal):

```bash
# 1. Lépj be a szerverre
ssh ubuntu@A_TE_LIGHTSAIL_IP_CIMED

# 2. Másold át vagy klónozd a projektet a /opt/pawnder mappába
cd /opt/pawnder
git clone https://github.com/FELHASZNALONEV/pawnder.git .

# 3. Indítsd el a production konténereket
docker compose -f infra/docker-compose.prod.yml up -d --build
```

A **Caddy** automatikusan lekéri az ingyenes Let's Encrypt tanúsítványt az `api.pawnder.hu` címre, amint a DNS A-rekord rámutat a szerver IP-jére!

---

## 🛡️ Hasznos parancsok és karbantartás

- **Szerver állapot és logok ellenőrzése:**
  ```bash
  docker compose -f infra/docker-compose.prod.yml ps
  docker compose -f infra/docker-compose.prod.yml logs -f backend
  docker compose -f infra/docker-compose.prod.yml logs -f scraper-worker
  ```
- **Adatbázis biztonsági mentés:**
  ```bash
  docker exec -t pawnder-postgres-1 pg_dump -U pawnder_admin pawnder_prod | gzip > backup_$(date +%Y%m%d).sql.gz
  ```

