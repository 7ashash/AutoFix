export function requireAdmin(req, _res, next) {
  if (!req.auth?.user?.dashboardAccess?.admin) {
    const error = new Error("Admin access is required");
    error.statusCode = 403;
    next(error);
    return;
  }

  next();
}

export function requireDealerOrAdmin(req, _res, next) {
  if (!(req.auth?.user?.dashboardAccess?.dealer || req.auth?.user?.dashboardAccess?.admin)) {
    const error = new Error("Dealer access is required");
    error.statusCode = 403;
    next(error);
    return;
  }

  next();
}
