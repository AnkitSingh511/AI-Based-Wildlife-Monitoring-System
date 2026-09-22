// // import mongoose from "mongoose";

// // const connectDB = async () => {
// //     try {
// //         await mongoose.connect(process.env.MONGODB_URI);

// //         console.log("MongoDB connected successfully");
// //     } catch (error) {
// //         console.error("MongoDB connection failed:", error.message);
// //         process.exit(1);
// //     }
// // };

// // export default connectDB;


// import mongoose from "mongoose";

// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI, {
//             family: 4
//         });

//         console.log("MongoDB connected successfully");
//     } catch (error) {
//         console.error("MongoDB connection failed:", error);
//         process.exit(1);
//     }
// };

// export default connectDB;

// import mongoose from "mongoose";

// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI);

//         console.log("MongoDB connected successfully");
//     } catch (error) {
//         console.error("MongoDB connection failed:", error.message);
//         process.exit(1);
//     }
// };

// export default connectDB;


import mongoose from "mongoose";
import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected successfully");
    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        process.exit(1);
    }
};

export default connectDB;