const express = require('express')
const cors = require('cors')
const { google } = require('@ai-sdk/google')
const { generateText, generateObject } = require('ai')
const { z } = require('zod')

const app = express()
const PORT = process.env.PORT || 3001

// 中間件
app.use(cors())
app.use(express.json())

// 設定 API 金鑰（記得設定環境變數）
// export GOOGLE_GENERATIVE_AI_API_KEY="AIzaSyCSF6jh0AGpmHkeZotNjZs6SbS9yyN2mrs"

// 分析端點
app.post('/api/analyze', async (req, res) => {
  try {
    const { topic } = req.body

    if (!topic) {
      return res.status(400).json({ error: '請提供研究主題' })
    }

    console.log(`開始分析主題: ${topic}`)

    // 步驟 1: 使用 Google 搜尋進行研究
    const { text: researchData, sources } = await generateText({
      model: google('gemini-2.5-flash'),
      tools: {
        google_search: google.tools.googleSearch({}),
      },
      prompt: `請搜尋關於「${topic}」的最新資訊和數據。
      我需要：
      1. 相關的統計數據和趨勢
      2. 重要的數字和比例
      3. 時間序列資料（如果有的話）
      4. 地區性分布資料（如果適用）
      5. 關鍵指標和變化趨勢
      
      請提供具體的數字和可量化的資訊。`,
    })

    console.log('研究資料獲取完成')

    // 步驟 2: 提取結構化的圖表資料
    const { object: chartData } = await generateObject({
      model: google('gemini-2.5-flash'),
      schema: z.object({
        summary: z.string().describe('研究主題的摘要，約200字'),
        keyFindings: z.array(z.string()).describe('3-5個關鍵發現'),
        charts: z
          .array(
            z.object({
              type: z
                .enum(['bar', 'line', 'pie', 'doughnut'])
                .describe('圖表類型'),
              title: z.string().describe('圖表標題'),
              labels: z.array(z.string()).describe('圖表標籤'),
              data: z.array(z.number()).describe('圖表資料'),
              backgroundColor: z
                .array(z.string())
                .optional()
                .describe('背景顏色陣列'),
              borderColor: z
                .array(z.string())
                .optional()
                .describe('邊框顏色陣列'),
              unit: z
                .string()
                .optional()
                .describe('數據單位，如 %、萬人、億元等'),
            })
          )
          .describe('1-8個圖表配置'),
      }),
      prompt: `基於以下研究資料，請生成結構化的分析結果和圖表資料：

研究資料：
${researchData}

請生成：
1. 一個簡潔的摘要
2. 3-5個關鍵發現
3. 1-8個有意義的圖表，包含真實數據

圖表應該包含具體的數字，不要使用假資料。如果某類型的資料不適合特定圖表，請選擇最合適的圖表類型。
顏色請使用適合的 rgba 或 hex 格式。`,
    })

    console.log('圖表資料生成完成')

    // 回傳結果
    res.json({
      success: true,
      data: {
        topic,
        summary: chartData.summary,
        keyFindings: chartData.keyFindings,
        charts: chartData.charts,
        sources: sources?.slice(0, 5) || [], // 限制回傳前5個來源
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('分析過程發生錯誤:', error)
    res.status(500).json({
      success: false,
      error: '分析過程發生錯誤，請稍後再試',
    })
  }
})

// 健康檢查端點
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`)
  console.log('請確保已設定 GOOGLE_GENERATIVE_AI_API_KEY 環境變數')
})
