const { proxyBackendRequest } = require("../lib/backend-proxy");

function jobIdFrom(req) {
    const value = req.query?.jobId;
    return Array.isArray(value) ? value[0] : value;
}

function routeFrom(req) {
    const value = req.query?.fitmentPath;
    return Array.isArray(value) ? value[0] : value || "";
}

module.exports = async (req, res) => {
    const jobId = jobIdFrom(req);
    const route = routeFrom(req);
    if (!/^[0-9a-f-]{36}$/i.test(jobId || "")) {
        res.status(400).json({ detail: "A valid jobId is required" });
        return;
    }
    const allowedRoutes = new Set([
        "",
        "catalogue/regions",
        "catalogue/makes",
        "catalogue/models",
        "catalogue/years",
        "vehicle-variants",
        "vehicle-variants/apply",
        "status",
    ]);
    if (!allowedRoutes.has(route)) {
        res.status(400).json({ detail: "Unsupported Fitment route" });
        return;
    }

    await proxyBackendRequest(req, res, {
        backendPath: route === "status"
            ? `/jobs/${jobId}/status`
            : `/jobs/${jobId}/fitment${route ? `/${route}` : ""}`,
        stripQueryKeys: ["jobId", "fitmentPath"],
    });
};
