const { AuthenticationError, UserInputError } = require("apollo-server");

const Post = require("../../models/Post");
const checkAuth = require("../../utils/auth");

module.exports = {
  Query: {
    getPosts: async () => {
      try {
        const posts = await Post.find().sort({ createdAt: -1 });
        return posts;
      } catch (e) {
        throw new Error(e);
      }
    },
    getPost: async (_, { postId }) => {
      try {
        const post = await Post.findById(postId);

        if (post) {
          return post;
        } else {
          throw new Error("Post not found");
        }
      } catch (e) {
        throw new Error(e);
      }
    },
  },
  Mutation: {
    createPost: async (_, { body }, context) => {
      const user = checkAuth(context);

      if (body.trim() === "") {
        throw new UserInputError("Post body must not be empty");
      }

      const newPost = new Post({
        body,
        user: user.id,
        username: user.username,
        createdAt: new Date().toISOString(),
      });

      const post = newPost.save();

      context.pubsub.publish("NEW_POST", {
        newPost: post,
      });

      return post;
    },
    deletePost: async (_, { postId }, context) => {
      const user = checkAuth(context);

      try {
        const post = await Post.findById(postId);

        if (user.username === post.username) {
          await post.delete();
          return "Successfully deleted the post";
        } else {
          throw new AuthenticationError("Action not allowed");
        }
      } catch (e) {
        throw new Error(e);
      }
    },
    createComment: async (_, { postId, body }, context) => {
      const { username } = checkAuth(context);

      if (body.trim() === "") {
        throw new UserInputError("Empty comment", {
          errors: {
            body: "Comments body must not be empty",
          },
        });
      }

      const post = await Post.findById(postId);

      if (post) {
        post.comments.unshift({
          body,
          username,
          createdAt: new Date().toISOString(),
        });

        await post.save();
        return post;
      } else throw new UserInputError("Post not found");
    },
    deleteComment: async (_, { postId, commentId }, context) => {
      const { username } = checkAuth(context);

      const post = await Post.findById(postId);

      if (post) {
        const commentIndex = post.comments.findIndex((c) => c.id === commentId);

        if (
          commentIndex > 1 &&
          post.comments[commentIndex].username === username
        ) {
          post.comments.splice(commentIndex, 1);
          await post.save();
          return post;
        } else {
          throw new AuthenticationError("Action not allowed");
        }
      } else {
        throw new UserInputError("Post not found");
      }
    },
    likePost: async (_, { postId }, context) => {
      const { username } = checkAuth(context);

      const post = await Post.findById(postId);

      if (post) {
        if (post.likes.find((like) => like.username === username)) {
          // post already liked, unlike it
          post.likes = post.likes.filter((like) => like.username !== username);
        } else {
          // not likec, like post
          post.likes.push({
            username,
            createdAt: new Date().toISOString(),
          });
        }

        await post.save();
        return post;
      } else throw new UserInputError("Post not found");
    },
  },
  Subscription: {
    newPost: {
      subscribe: (_, __, { pubsub }) => pubsub.asyncIterator("NEW_POST"),
    },
  },
};
