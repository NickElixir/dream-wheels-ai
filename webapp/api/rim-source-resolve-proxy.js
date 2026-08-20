const { proxyBackendRequest } = require("../lib/backend-proxy");

function jobIdFrom(req) {
    const value = req.query?.jobId;
    return Array.isArray(value) ? value[0] : value;
}

module.exports = async (req, res) => {
    const jobId = jobIdFrom(req);
    if (!/^[0-9a-f-]{36}$/i.test(jobId || "")) {
        res.status(400).json({ detail: "A valid jobId is required" });
        return;
    }

    await proxyBackendRequest(req, res, {
        backendPath: `/jobs/${jobId}/fitment/rim-source/resolve`,
        stripQueryKeys: ["jobId"],
    });
};
