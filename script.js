export default async function handler(req, res) {
    // 1. Добавляем заголовки CORS, чтобы Telegram не блокировал запросы
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 2. Если Telegram отправляет проверочный запрос (OPTIONS) — отвечаем "Всё ок"
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 3. Если это не POST и не OPTIONS — отбиваем
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { imageBase64, mimeType } = req.body;
        
        const apiKey = process.env.GEMINI_API_KEY; 

        if (!apiKey) {
            return res.status(500).json({ error: 'API ключ не настроен' });
        }

        const promptText = `
            Ты финансовый помощник. Проанализируй этот скриншот из банковского приложения или чек.
            Найди все финансовые операции. 
            Верни результат СТРОГО в формате JSON-массива объектов, без markdown и лишнего текста.
            Ключи объекта:
            "description": Строка, название магазина или категории.
            "amount": Число. Отрицательное для расходов, положительное для доходов.
            "date": Строка в формате "YYYY-MM-DD". Если дату определить нельзя, верни "".
            Если операций не найдено, верни [].
        `;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: promptText },
                        { inline_data: { mime_type: mimeType, data: imageBase64 } }
                    ]
                }]
            })
        });

        const data = await response.json();
        
        let responseText = data.candidates[0].content.parts[0].text;
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        const transactions = JSON.parse(responseText);
        return res.status(200).json({ transactions });

    } catch (error) {
        console.error('Ошибка парсинга:', error);
        return res.status(500).json({ error: 'Не удалось распознать чек' });
    }
}
