/**
 * 404 页面未找到处理中间件
 */
const notFound = (req, res) => {
  res.status(404).json({
    code: 404,
    message: `接口 ${req.method} ${req.originalUrl} 不存在`,
    data: null,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  });
};

module.exports = notFound;