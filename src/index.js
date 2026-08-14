export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ok:true,service:"compute-worker",source:"github-static-relay"});
    return Response.json({service:"compute-worker",status:"ready"});
  }
};
