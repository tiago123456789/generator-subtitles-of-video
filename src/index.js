const {
    TranscribeClient,
    StartTranscriptionJobCommand,
} = require("@aws-sdk/client-transcribe");
const AWS = require("aws-sdk")
const { v4 } = require("uuid")
const fs = require("fs")
const srtConvert = require("aws-transcription-to-srt");
var ffmpeg = require('fluent-ffmpeg');

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

    upload(file, bucket, content, contentType) {
        return this.s3.upload({
            Bucket: bucket,
            Key: file,
            ContentType: contentType || "video/mp4",
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

    addSubtitlesInVideo(pathVideo, pathSubtitles, outputPath) {
        return new Promise((resolve, reject) => {
            ffmpeg(pathVideo)
                .outputOptions(
                    `-vf subtitles=${pathSubtitles}:force_style='FontName=ubuntu,Fontsize=12'`
                )
                .output(outputPath)
                .on('stderr', function (stderrLine) {
                    reject(stderrLine)
                })
                .on('end', function () {
                    resolve({ pathVideo, pathSubtitles })
                })
                .run()
        })

    }

    generateSubtitleNativeLanguage(params) {
        return this.client.send(new StartTranscriptionJobCommand(params));
    }

    async getNativeLanguageSubtitles(params) {
        const data = await this.S3Storage.get(params.key, params.bucket)
        const jsonData = data.Body.toString("utf-8")
        const json = JSON.parse(jsonData);
        let text = srtConvert(json);
        text = `WEBVTT FILE\n\n${text}`
        return text
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
            params.destinyBucket, Buffer.from(text, "utf-8"), "plain/text"
        ).then(data => ({ ...data, language: params.language }));
    }
}



// const content = fs.readFileSync("./tiktok.mp4")
const s3Storage = new S3Storage();
const videoSubtitle = new VideoSubtitle()
// new S3Storage()
//     .upload(`video${v4()}.mp4`, "videos-subtitle-generate", content)
//     .then(async data => {
//         const key = v4()
//         const params = {
//             TranscriptionJobName: `video${v4()}.mp4`,
//             LanguageCode: "pt-BR",
//             MediaFormat: "mp4",
//             Media: {
//                 MediaFileUri: data.Location
//             },
//             OutputBucketName: "videos-subtitles-generated",
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

videoSubtitle.getNativeLanguageSubtitles(
    {
        key: "4d0f5649-03d6-4de4-80cc-c985b03d64b4",
        bucket: "videos-subtitles-generated",
    }
).then((subtitles) => {
    fs.writeFileSync("subtitles.pt.vtt", subtitles)
    return videoSubtitle.addSubtitlesInVideo(
        "./tiktok.mp4",
        "./subtitles.pt.vtt",
        `./tiktok.pt.mp4`
    )
})
// Promise.all(
//     [
//         videoSubtitle.generateSubtitleAnotherLanguage({
//             language: "en",
//             key: "4d0f5649-03d6-4de4-80cc-c985b03d64b4",
//             bucket: "videos-subtitles-generated",
//             destinyBucket: "videos-subtitles-finished"
//         }),
//         videoSubtitle.generateSubtitleAnotherLanguage({
//             language: "es",
//             key: "4d0f5649-03d6-4de4-80cc-c985b03d64b4",
//             bucket: "videos-subtitles-generated",
//             destinyBucket: "videos-subtitles-finished"
//         })
//         // videoSubtitle.generateSubtitleAnotherLanguage({
//         //     language: "es",
//         //     key: "309bcd93-227b-4948-948d-3dc91505d13d",
//         //     bucket: "",
//         //     destinyBucket: ""
//         // }),
//         // videoSubtitle.generateSubtitleAnotherLanguage({
//         //     language: "ru",
//         //     key: "309bcd93-227b-4948-948d-3dc91505d13d",
//         //     bucket: "",
//         //     destinyBucket: ""
//         // })
//     ]).then((data) => {
//         return Promise.all(
//             data.map(async item => {
//                 const subtitle = await s3Storage.get(item.key, item.Bucket);
//                 fs.writeFileSync(item.key, subtitle.Body)
//                 return videoSubtitle.addSubtitlesInVideo(
//                     "./tiktok.mp4",
//                     item.key,
//                     `./tiktok.${item.language}.mp4`
//                 )
//             })
//         )
//     })
//     .then((data) => {
//         data.map(item => {
//             fs.unlinkSync(item.pathSubtitles)
//         })
//         console.log("Finish")
//     })
//     .catch(console.log)