import { getAmbassadorDashboardData, getAmbassadorOrders } from "./ambassadorDashboard.repository.js";

export const getDashboardDataService = async (ambassadorId) => {
  const data = await getAmbassadorDashboardData(ambassadorId);
  if (!data) throw new Error("AMBASSADOR_NOT_FOUND");
  return data;
};

export const getAmbassadorOrdersService = async (ambassadorId, { page, limit }) => {
  return getAmbassadorOrders(ambassadorId, { page, limit });
};
