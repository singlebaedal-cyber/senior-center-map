let runtimeKakaoKey = process.env.KAKAO_JS_KEY || "82823b59e8640ba8b58e403c7463064a";

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (req.method === 'GET') {
    return res.status(200).json({
      kakaoJsKey: runtimeKakaoKey
    });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.kakaoJsKey && typeof body.kakaoJsKey === 'string') {
      runtimeKakaoKey = body.kakaoJsKey.trim();
    }
    return res.status(200).json({
      success: true,
      kakaoJsKey: runtimeKakaoKey
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
