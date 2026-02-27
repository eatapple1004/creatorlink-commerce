import { getAmbassadorDashboardData } from "./ambassadorDashboard.repository.js";

export const getDashboardDataService = async (ambassadorId) => {
  const data = await getAmbassadorDashboardData(ambassadorId);
  if (!data) throw new Error("AMBASSADOR_NOT_FOUND");
  return data;
};
