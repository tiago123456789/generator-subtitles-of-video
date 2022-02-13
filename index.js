const AWS = require("aws-sdk")
const {
    TranscribeClient,
    StartTranscriptionJobCommand,
    GetTranscriptionJobCommand, SubtitleFormat
} = require("@aws-sdk/client-transcribe");

// const s3 = new AWS.S3({});

// const content = require("fs").readFileSync("./video.mp4")
// s3.upload({
//         Bucket: "substitles-videos",
//         Key: "video.mp4",
//         ContentType: "video/mp4",
//         Body: content
//     })
//     .promise()
//     .then(console.log)
//     .catch(console.log)

const location = "https://substitles-videos.s3.amazonaws.com/video.mp4"

// Set the parameters
const params = {
    TranscriptionJobName: "transcription-subtitles-video-2",
    LanguageCode: "pt-BR",
    MediaFormat: "mp4",
    Subtitles: {
        Formats: SubtitleFormat.SRT
    },
    Media: {
        MediaFileUri: location
    },
};

// Create an Amazon Transcribe service client object
const client = new TranscribeClient();

const startTranscription = async () => {
    try {
        const data = await client.send(new StartTranscriptionJobCommand({
            ...params,
            // OutputBucketName?: string
            // OutputKey?: string
        }));
        console.log("Success - StartTranscriptionJobCommand", data);
        // setInterval(() => getTranscriptionDetails(), 30000);
    } catch (err) {
        console.log("Error", err);
    }
};

const getTranscriptionDetails = async () => {
    try {
        const data = await client.send(new GetTranscriptionJobCommand(params));
        const status = data.TranscriptionJob.TranscriptionJobStatus;
        if (status === "COMPLETED") {
            console.log("URL:", data.TranscriptionJob.Transcript.TranscriptFileUri);
        } else if (status === "FAILED") {
            console.log("Failed:", data.TranscriptionJob.FailureReason);
        } else {
            console.log("In Progress...");
            // getTranscriptionDetails();
        }
    } catch (err) {
        console.log("Error", err);
    }
};

startTranscription();
