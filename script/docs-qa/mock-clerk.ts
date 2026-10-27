export async function verifyToken(token: string) {
  if (!["owner","other","public-trial"].includes(token)) throw new Error("Invalid test identity");
  return {sub:token};
}
export const createClerkClient = () => ({ users: {
  getUser: async (id:string) => ({
    id, publicMetadata: id === "public-trial" ? {} : { plan:"trial",subscribed:true,trialCreditLimit:140 },
    primaryEmailAddress:{emailAddress:`${id}@example.invalid`,verification:{status:"verified"}},
  }),
  getOrganizationMembershipList: async () => ({data:[]}),
}});
