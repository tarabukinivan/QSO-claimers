<img src='qso-soft.png'/>

# Usage overview | QSO-soft
## Steps to set up script:

1. Установить [VisualStudio Code](https://code.visualstudio.com/) или Sublime Text или любую другую IDE

2. Установка node, npm, git
: 2.1. Устанавливаем Node +, если версия ниже 20й - https://nodejs.org/en/download, либо - https://github.com/coreybutler/nvm-windows
: 2.2. Устанавливаем Git, если еще не установлен - https://gitforwindows.org/ (всё по умолчанию выбирайте)
: 2.3. Устанавливаем его глобально
```bash
npm install npm -g
npm install typescript -g
```

3. После установки Git у вас должен появиться bash в выборе терминалов в VS Code (на стрелочку нажмите снизу в терминале и там будет Git Bash). Используем обязательно его или zsh! Главное, не powershell!

4. Проверяем версию Node, NPM и NVM.
```bash
node -v && git -v && npm -v
# v20.8.0 (не обязательно прям цифра в цифру, главное чтобы была версия выше v20)
# git version 2.42.0 (все равно на версию)
# 9.8.1 (все равно на версию)
```

5. Переходим на рабочий стол
```bash
cd ./<путь на рабочий стол>
```

6. Клонируем репозиторий и выполняем логин в GitHub, так как это приватный репозиторий
```bash
git clone https://github.com/QSO-soft/QSO-claimers.git
```

7. Переходим в папку с проектом
```bash
cd QSO-claimers
```

8. Устанавливаем нужные зависимости
```bash
npm i
```

9.  Подготавливаем файлы к работе
```bash
npm run prepare-files
```

10. Заполняем файлы
: 10.1. `src/_inputs/settings/global.js` (OKX/Binance)
: 10.2. `src/_inputs/settings/settings.ts` (Задержки, потоки)
: 10.3. `src/_inputs/settings/routes/[projectName].ts` (Флоу софта можете подредачить)
: 10.4. `src/_inputs/csv/[projectName]-wallets.csv` (НЕ УДАЛЯЙТЕ HEADER CSV ФАЙЛА! Это не .txt! Кошельки сюда)
: 10.5. `src/_inputs/csv/proxies.csv` (Не обязательно)

11.  npm start

---
```
✔️ QSO-claimers (https://github.com/QSO-soft/QSO-claimers) - проверить / заклеймить кошельки можете через наш открытый софт

Функционал:
➡️ Claim SCR
➡️ Transfer на любую биржу / кошелёк
➡️ Запись в CSV полного статуса кошелька
➡️ Собирает со всех суб-адресов в Bitget
➡️ Мультипоточность
➡️ Работает как на Windows, так и на Linux
➡️ Вставить можете любые кошельки. Если нужно заклеймит и отправит, либо только отправит, если клейм был уже до этого. Либо пропустит, если уже и клейм и отправка была сделана до этого при этом запишет всю инфу так же в CSV

Инструкция:
➡️ Клонируем репозиторий (https://github.com/QSO-soft/QSO-claimers)
➡️ Запускаем в bash терминале: npm run prepare-files && npm i 
➡️ Полный гайд по запуску так же можно найти в самом репозитории (https://github.com/QSO-soft/QSO-claimers/blob/main/README.md)
➡️ Вставляем всю инфу в файл /src/_inputs/csv/scroll-wallets.csv (https://github.com/QSO-soft/QSO-claimers/blob/main/src/_inputs/csv/wallets.example.csv) (Поля: id, walletAddress, proxy - опцианальны! Их можно НЕ заполнять!). Header в CSV файле (первая самая строчка) НЕ удалять! Там уже есть пример как должен выглядеть готовый файл. 
➡️ npm start
➡️ По желанию можете добавить в /src/_inputs/settings/global.js (https://github.com/QSO-soft/QSO-claimers/blob/main/src/_inputs/settings/global.example.js) данные для логов в Telegram и ключи от Bitget
➡️ Управлять разными настройками можете в /src/_inputs/settings/settings.ts (https://github.com/QSO-soft/QSO-claimers/blob/main/src/_inputs/settings/settings.ts)
➡️ Когда софт закончит выполнение он запишет весь результат в /src/_outputs/csv/checkers/scroll-claim.csv

🔝 Darvin Space (https://t.me/darvin_crypto_notes/200) - все мои софты и актуальные мысли по рынку сможете найти здесь

## Scripts

- [Claimers](src/scripts/claimers/README.md)
```
