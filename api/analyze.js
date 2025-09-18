// api/analyze.js
import { google } from '@ai-sdk/google'
import { generateText, generateObject } from 'ai'
import { z } from 'zod'

// Vercel 無伺服器函數格式
export default async function handler(req, res) {
  // CORS 設定（重要！）
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,OPTIONS,PATCH,DELETE,POST,PUT'
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  // 處理預檢請求
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  // 只接受 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { topic } = req.body

    if (!topic) {
      return res.status(400).json({ error: '請提供研究主題' })
    }

    console.log(`開始分析主題: ${topic}`)

    // ============ 這裡是你 server.js 中的分析邏輯，完全複製過來 ============
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

    // 回傳結果（和 server.js 中一樣）
    res.json({
      success: true,
      data: {
        topic,
        summary: chartData.summary,
        keyFindings: chartData.keyFindings,
        charts: chartData.charts,
        sources: sources?.slice(0, 5) || [],
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
}
