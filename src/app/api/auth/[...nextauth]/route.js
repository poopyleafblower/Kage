import NextAuth from "next-auth";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/mongodb/db";
import { getServerSession } from "next-auth";

const graphqlEndpoint = process.env.GRAPHQL_ENDPOINT || "https://graphql.anilist.co";

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise),
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    {
      id: "AniListProvider",
      name: "AniList",
      type: "oauth",
      token: "https://anilist.co/api/v2/oauth/token",
      authorization: {
        url: "https://anilist.co/api/v2/oauth/authorize",
        params: {
          response_type: "code",
        },
      },
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
            image: viewer.avatar,
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
