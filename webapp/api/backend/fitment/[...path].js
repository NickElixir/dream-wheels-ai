const { proxyBackendRequest } = require("../../../lib/backend-proxy");

module.exports = async (req, res) => {
    const checkId = Array.isArray(req.query?.checkId) ? req.query.checkId[0] : req.query?.checkId;
    if (checkId && !/^[0-9a-f-]{36}$/i.test(checkId)) {
        res.status(400).json({ detail: "A valid checkId is required" });
        return;
    }
    await proxyBackendRequest(req, res, {
        backendPath: checkId ? `/fitment/checks/${checkId}` : undefined,
        stripQueryKeys: ["checkId"],
    });
};
