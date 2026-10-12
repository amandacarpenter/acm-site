export async function verifyToken(token: string) {
  if (!["owner","other"].includes(token)) throw new Error("Invalid test identity");
  return {sub:token};
}
export const createClerkClient = () => ({ users: {
  getUser: async (id:string) => ({ id, publicMetadata: { plan:"trial",subscribed:true,trialCreditLimit:140 }, primaryEmailAddress:{emailAddress:`${id}@example.invalid`} }),
}});
