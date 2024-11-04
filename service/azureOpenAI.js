require('dotenv').config();
const axios = require('axios');

// 查詢 Azure AI Search 的資料
async function searchAzureIndex(searchText) {
    try {
        const reqBody = {
            search: searchText,
            queryType: 'simple',
            searchMode: 'any',
            top: 5  // 返回最多5個結果
        };
        const res = await axios.post(
            `${ process.env.AZURE_SEARCH_ENDPOINT }/indexes/${ process.env.AZURE_SEARCH_INDEX_NAME }/docs/search?api-version=2024-05-01-preview`,
            reqBody,
            {
                headers: {
                    'content-type': 'application/json',
                    'api-key': process.env.AZURE_SEARCH_KEY
                }
            }
        );

        // 檢查查詢結果是否為空
        if (!res.data.value || res.data.value.length === 0) {
            // 返回通用回應
            return '目前無相關資料，以通用資料直接回應';
        }

        return res.data.value.map(doc => doc.content).join('\n');
    } catch (error) {
        console.error('Azure Search Error:', error);
        // 發生錯誤時也返回通用回應而不顯示錯誤訊息
        return '目前無相關資料，以通用資料直接回應。';
    }
}

// 主函數：處理OpenAI API回應
async function openAIPrompt(userPrompt) {
    try {
        // 調用 Azure AI Search 並獲取相關內容
        const searchResults = await searchAzureIndex(userPrompt);
        
        // 如果查詢結果為通用回應，直接回應
        if (searchResults === '目前無相關資料，以通用資料直接回應。') {
            return searchResults;
        }

        // 若有查詢結果，將其加入 prompt
        const reqBody = {
            messages: [
                {
                    role: 'system',
                    content: '你是一個處理員工疑難雜症的人力資源HR AI助理君君(JunJun)。請用常見員工能夠聽懂的繁體中文語言和親切的口吻來回答，兩句話簡單描述，上限是三句。相關問題可能包括不限於外籍移工、實習計畫、薪資考勤、保險、海外派駐、教育訓練等問題，您也可以根據檢索到的文件回答問題，除了協助回答相關問題也可以和大家聊天。'
                },
                {
                    role: 'user',
                    content: userPrompt
                },
                {
                    role: 'system',
                    content: `以下是從資料庫查詢的結果：${searchResults}`
                },
                {
                    role: 'assistant',
                    content: ''
                }
            ],
            temperature: 0.35,
            top_p: 0.95,
            frequency_penalty: 0,
            presence_penalty: 0,
            max_tokens: 800,
            stop: null
        };
        const res = await axios.post(
            `${ process.env.AZURE_OPENAI_ENDPOINT }openai/deployments/${ process.env.AZURE_OPENAI_MODEL_DEPLOYMENT_NAME }/chat/completions?api-version=2024-08-01-preview`,
            JSON.stringify(reqBody),
            {
                headers: {
                    'content-type': 'application/json',
                    'api-key': process.env.AZURE_OPENAI_KEY
                }
            }
        );
        return res.data.choices[0].message.content;
    } catch (error) {
        console.error(error);
        return `${ error.response.status } - ${ error.response.statusText }`;
    }
}

module.exports = {
    openAIPrompt
};
