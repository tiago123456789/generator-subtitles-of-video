const {
    TranscribeClient,
    StartTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");
const AWS = require("aws-sdk")
const { v4 } = require("uuid")
const fs = require("fs")
const srtConvert = require("aws-transcription-to-srt");


class S3Storage {

    constructor() {
        this.s3 = new AWS.S3({});
    }

    get(filename, bucket) {
        return this.s3.getObject({
            Bucket: bucket,
            Key: filename
        })
            .promise()
    }

    upload(file, bucket, content) {
        return this.s3.upload({
            Bucket: bucket,
            Key: file,
            ContentType: "text/plain",
            Body: content
        })
            .promise()
    }
}

class VideoSubtitle {

    constructor() {
        this.client = new TranscribeClient();
        this.S3Storage = new S3Storage()
        this.translate = new AWS.Translate({ region: "us-east-1" })
    }

    generateSubtitleNativeLanguage(params) {
        return this.client.send(new StartTranscriptionJobCommand(params));
    }

    async generateSubtitleAnotherLanguage(params) {
        const data = await this.S3Storage.get(params.key, params.bucket)
        const jsonData = data.Body.toString("utf-8")
        const json = JSON.parse(jsonData);
        let srt = srtConvert(json);
        let positionText = 2
        const subtitles = srt.split(/\n/)
        const translations = await Promise.all(
            subtitles.map((item, index) => {
                if (positionText == index) {
                    const translateAction = this.translate.translateText({
                        Text: item,
                        SourceLanguageCode: "pt-BR",
                        TargetLanguageCode: params.language
                    })
                        .promise()
                        .then(data => {
                            return `${subtitles[index - 2]}\n${subtitles[index - 1]}\n${data.TranslatedText}\n`
                        })
                    positionText += 4;
                    return translateAction
                }
            })
        )

        let text = translations.filter(item => item != undefined).join("\n");
        text = `WEBVTT FILE\n\n${text}`

        return this.S3Storage.upload(
            `subtitles.${params.key}.${params.language}.vtt`,
            params.destinyBucket, Buffer.from(text, "utf-8")
        );
    }
}



// const content = fs.readFileSync("./video.mp4")
// const videoSubtitle = new VideoSubtitle()
// new S3Storage()
//     .upload(`video${v4()}.mp4`, "videos-subtitle-generate", content)
//     .then(async data => {
// const key = v4()
//         const params = {
//             TranscriptionJobName: `video${v4()}.mp4`,
//             LanguageCode: "pt-BR",
//             MediaFormat: "mp4",
//             Media: {
//                 MediaFileUri: data.Location
//             },
//             OutputBucketName: "",
//             OutputKey: key
//         };

//         const result = await videoSubtitle.generateSubtitleNativeLanguage(params);
//         return {
//             ...result,
//             outputBucketName: "",
//             outputKey: key
//         }
//     })
//     .then(console.log)

// Promise.all(
//     [
//         videoSubtitle.generateSubtitleAnotherLanguage({
//             language: "en",
//             key: "309bcd93-227b-4948-948d-3dc91505d13d",
//             bucket: "",
//             destinyBucket: ""
//         }),
//         videoSubtitle.generateSubtitleAnotherLanguage({
//             language: "es",
//             key: "309bcd93-227b-4948-948d-3dc91505d13d",
//             bucket: "",
//             destinyBucket: ""
//         }),
//         videoSubtitle.generateSubtitleAnotherLanguage({
//             language: "ru",
//             key: "309bcd93-227b-4948-948d-3dc91505d13d",
//             bucket: "",
//             destinyBucket: ""
//         })
//     ]).then(() => console.log("Finish"))