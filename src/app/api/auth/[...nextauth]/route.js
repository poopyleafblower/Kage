import NextAuth from "next-auth";
import { getServerSession } from "next-auth";

const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT || "https://graphql.anilist.co";

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    {
      id: "anilist",
      name: "AniList",
      type: "oauth",
      token: {
        url: "https://anilist.co/api/v2/oauth/token",
        async request(context) {
          const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/callback/anilist`;
          const response = await fetch("https://anilist.co/api/v2/oauth/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              grant_type: "authorization_code",
              client_id: process.env.ANILIST_CLIENT_ID,
              client_secret: process.env.ANILIST_CLIENT_SECRET,
              redirect_uri: redirectUri,
              code: context.params.code,
            }),
            cache: "no-store",
          });

          const tokens = await response.json();

          if (!response.ok || !tokens?.access_token) {
            const message =
              tokens?.message ||
              tokens?.error_description ||
              tokens?.error ||
              `AniList token exchange failed with status ${response.status}`;
            throw new Error(message);
          }

          return { tokens };
        },
      },
      authorization: {
        url: "https://anilist.co/api/v2/oauth/authorize",
        params: {
          response_type: "code",
        },
      },
      checks: ["state"],
      userinfo: {
        url: graphqlEndpoint,
        async request(context) {
          const response = await fetch(graphqlEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${context.tokens.access_token}`,
              Accept: "application/json",
            },
            body: JSON.stringify({
              query: `
                query KageViewer {
                  Viewer {
                    id
                    name
                    avatar {
                      large
                      medium
                    }
                    bannerImage
                    createdAt
                    mediaListOptions {
                      animeList {
                        customLists
                      }
                    }
                  }
                }
              `,
            }),
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error(`AniList viewer request failed with status ${response.status}`);
          }

          const payload = await response.json();
          const viewer = payload?.data?.Viewer;

          if (!viewer?.id) {
            const message =
              payload?.errors?.map((error) => error?.message).filter(Boolean).join(", ") ||
              "AniList did not return a viewer profile";
            throw new Error(message);
          }

          return {
            token: context.tokens.access_token,
            name: viewer.name,
            sub: String(viewer.id),
            image: viewer.avatar?.large || viewer.avatar?.medium || null,
            avatar: viewer.avatar || null,
            bannerImage: viewer.bannerImage,
            createdAt: viewer.createdAt,
            list: viewer?.mediaListOptions?.animeList?.customLists || [],
          };
        },
      },
      clientId: process.env.ANILIST_CLIENT_ID,
      clientSecret: process.env.ANILIST_CLIENT_SECRET,
      profile(profile) {
        return {
          token: profile.token,
          id: profile.sub,
          name: profile.name,
          image: profile.image,
          avatar: profile.avatar,
          bannerImage: profile.bannerImage,
          createdAt: profile.createdAt,
          list: profile.list,
        };
      },
    },
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    error: "/auth/error",
  },
  callbacks: {
    async jwt({ token, user }) {
      return user ? { ...token, ...user } : token;
    },
    async session({ session, token }) {
      session.user = token;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export const getAuthSession = () => getServerSession(authOptions);

export { handler as GET, handler as POST };
