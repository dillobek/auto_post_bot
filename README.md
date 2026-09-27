# Shifokor autopost

## Admin panel

```powershell
npm install
npm run dev
```

## Telegram bot worker

```powershell
npm --prefix apps/bot install
Copy-Item apps/bot/.env.example apps/bot/.env
npm run test:bot
npm run dev:bot
```

`BOT_MODE=mock` standart va xavfsiz lokal rejimdir. Haqiqiy botni ishga tushirish uchun `BOT_MODE=polling`, `TELEGRAM_BOT_TOKEN`, shifokorning Telegram IDsi hamda kanal/guruh IDlarini `apps/bot/.env` ga kiriting.

Token, kanal va muhokama guruhini admin panelning **Sozlamalar → Telegram ulanishi** qismidan ham kiritish mumkin. Root `.env` fayliga 32 baytli base64 `CONFIG_ENCRYPTION_KEY` qo‘ying. Token `data/telegram-settings.enc` fayliga AES-256-GCM bilan shifrlab yoziladi va Gitga qo‘shilmaydi. Bot worker shu kalit bilan uni o‘qiydi.

## Production domeni

Ilovaning production manzili `https://auto.aipixel.uz`. Deploy muhitida quyidagi environment qiymatlari bo‘lishi kerak:

```text
NEXT_PUBLIC_APP_URL=https://auto.aipixel.uz
CONFIG_ENCRYPTION_KEY=<32-baytli-base64-kalit>
```

Deploy platformasi bergan hostga DNS’da `auto` subdomeni uchun CNAME (yoki VPS IP manzili uchun A yozuv) qo‘shiladi. TLS sertifikatini hosting platformasi yoki reverse proxy ta’minlaydi.

### VPS auto-deploy

Production compose fayli web interfeysni `127.0.0.1:4300` portida va Telegram workerini alohida containerda ishga tushiradi. Nginx `auto.aipixel.uz` so‘rovlarini shu portga uzatadi. Serverdagi `auto-post-deploy.timer` har daqiqada GitHub `main` branchini tekshiradi; yangi push bo‘lsa `scripts/deploy-production.sh` Docker image’larni yangilab deploy qiladi.

Yoki admin panelning **Sozlamalar → Telegram ulanishi** oynasidan token, kanal va guruhni kiriting. Bunda root `.env` faylida 32 baytli base64 `CONFIG_ENCRYPTION_KEY` bo‘lishi shart. Token `data/telegram-settings.enc` fayliga AES-256-GCM bilan shifrlab yoziladi va Gitga qo‘shilmaydi. Bot worker ham shu kalit bilan ushbu faylni o‘qiydi.

Bot spam havolalari va takroriy xabarlarni moderatsiya qiladi, shifokorga tibbiy savol va xavfli alomatlar haqida private xabar yuboradi. Individual tashxis yoki dori tavsiyasi bermaydi. Guruhga shoshilinch javob faqat operator/shifokor tasdiqlagan `URGENT_GROUP_TEMPLATE` berilganda yuboriladi.
