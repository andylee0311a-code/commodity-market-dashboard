# Commodity Market Dashboard

一個可直接部署到 GitHub Pages 的互動式商品市場 Dashboard，追蹤以下美元計價期貨：

- 黃金期貨（GC=F）
- 白銀期貨（SI=F）
- 布蘭特原油期貨（BZ=F）

## 功能

- 1 個月、3 個月、6 個月、YTD、1 年、3 年、5 年、全部資料區間
- 自訂開始／結束日期
- 實際價格與「起點 = 100」相對表現切換
- 商品顯示／隱藏
- 最新價、單日漲跌、區間漲跌、區間高低點摘要
- GitHub Actions 於每個交易日收盤後自動更新資料並部署 GitHub Pages
- 響應式版面，支援桌機與手機

## 部署方式

1. 在 GitHub 建立一個空白 repository，例如 `commodity-market-dashboard`。
2. 將本專案所有檔案推送到 `main` branch。
3. 到 **Settings → Pages → Build and deployment → Source**，選擇 **GitHub Actions**。
4. 到 **Actions** 手動執行 `Update market data and deploy Pages`，或等待首次 push 自動執行。
5. 完成後可在 repository 的 **Deployments** 或 **Settings → Pages** 查看網址。

## 本機預覽

```bash
python -m http.server 8000
```

瀏覽器開啟 `http://localhost:8000`。

## 更新資料

```bash
pip install -r requirements.txt
python scripts/fetch_data.py
```

資料來源為 Yahoo Finance，由 `yfinance` 取得；報價可能延遲，僅供資訊參考，不構成投資建議。
