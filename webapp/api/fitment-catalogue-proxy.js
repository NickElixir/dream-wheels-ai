const { proxyBackendRequest } = require("../lib/backend-proxy");

function queryValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

module.exports = async (req, res) => {
    const jobId = queryValue(req.query?.jobId);
    const kind = queryValue(req.query?.kind);
    if (!/^[0-9a-f-]{36}$/i.test(jobId || "") || !/^(regions|makes|models|years)$/.test(kind || "")) {
        res.status(400).json({ detail: "A valid jobId and catalogue kind are required" });
        return;
    }

    await proxyBackendRequest(req, res, {
        backendPath: `/jobs/${jobId}/fitment/catalogue/${kind}`,
        stripQueryKeys: ["jobId", "kind"],
    });
};
