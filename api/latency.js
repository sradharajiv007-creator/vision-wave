module.exports = (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const latency = Math.round(140 + Math.random() * 220);
  const status = latency < 220 ? 'optimal' : latency < 320 ? 'moderate' : 'high';
  return res.status(200).json({
    latency,
    status,
    updatedAt: Date.now(),
  });
};

