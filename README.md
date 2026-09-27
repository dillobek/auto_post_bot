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

Bot spam havolalari va takroriy xabarlarni moderatsiya qiladi, shifokorga tibbiy savol va xavfli alomatlar haqida private xabar yuboradi. Individual tashxis yoki dori tavsiyasi bermaydi. Guruhga shoshilinch javob faqat operator/shifokor tasdiqlagan `URGENT_GROUP_TEMPLATE` berilganda yuboriladi.
