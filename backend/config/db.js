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


let isConnected = false;

const connectDB = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            await mongoose.connect(process.env.MONGODB_URI);
            isConnected = true;
            console.log("MongoDB connected successfully");
            return;
        } catch (error) {
            console.error(`MongoDB connection attempt ${i + 1} failed:`, error.message);
            if (i < retries - 1) {
                console.log("Retrying MongoDB connection in 3 seconds...");
                await new Promise((res) => setTimeout(res, 3000));
            } else {
                console.warn("MongoDB connection could not be established. Server will continue running but DB operations will fail.");
            }
        }
    }
};

export default connectDB;