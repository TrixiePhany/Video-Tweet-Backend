# Video-Tweet-Backend

## 📊 Database Flow Overview

This system is built around a social video platform with users, videos, subscriptions, playlists, likes, and comments. It is built around pure javacript, alongside MongoDB as it's database and Mongoose as it's ORM. You can also upload image files  using the middleware _CLoudinary_ . An ER-Diagram is attached for one to grasp how the Schemas are defined and connected with each other at the end of this documentation. Here’s how the pieces connect:

### Users
- Every person in the system is a User.
- A user can upload videos, post tweets, subscribe to other users, like videos, comment on videos, and create playlists.
- Upload Cover-Image and Avater for every user profile. 

### Videos
- Videos are uploaded by a User (the owner).
- Each video has metadata like title, description, duration, views, and publication status.
- Other users can like and comment on these videos.
- Videos can also be added into Playlists.

### Tweets
- Users can also post Tweets (like micro-posts).
- Each tweet belongs to a single user and stores the content plus a timestamp.

### Subscriptions
- A user can subscribe to another user’s channel.
- This is a self-relationship within the users table:
_Subscriber → Channel_

### Playlists
- Users can create playlists to group videos.
- A playlist has a name and description, and contains many videos.
- Since a video can belong to multiple playlists, we use a junction table (playlist_videos) to map videos to playlists.

### Likes
- A Like links a user to a video they’ve liked.
- Stores extra info like a description or inviterId if needed.
- Each like always belongs to one video and one user.

### Comments
- Comments allow users to discuss videos.
- A comment stores the text, timestamp, and which user wrote it.
- Every comment is linked to a video and a user (the commenter).

## Entity Relationship Diagram 
<img width="721" height="1063" alt="diagram-export-10-09-2025-20_57_21" src="https://github.com/user-attachments/assets/873705dd-96da-4ea8-8cc6-9e76c854cb88" />

You can clone this project and add your own routes and models to the project to make it a more scalable and vast backend project,
Thank You!

