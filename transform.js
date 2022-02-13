const srtConvert = require("aws-transcription-to-srt");
const AWS = require("aws-sdk")
const translate = new AWS.Translate({ region: "us-east-1" })
const fs = require("fs");

const generateSubtitlesToSpecificLanguage = (language) => {
  console.time()
  const data = fs.readFileSync("asrOutput.json", "utf8")
  const json = JSON.parse(data);
  let srt = srtConvert(json);
  let positionText = 2
  const subtitles = srt.split(/\n/)
  Promise.all(
    subtitles.map((item, index) => {
      if (positionText == index) {
        const translateAction = translate.translateText({
          Text: item,
          SourceLanguageCode: "pt-BR",
          TargetLanguageCode: language
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
    .then(translations => {
      let text = translations.filter(item => item != undefined).join("\n");
      text = `WEBVTT FILE\n\n${text}`
      fs.writeFileSync(`subtitles.${language}.vtt`, text)
      console.timeEnd()

    })
}

generateSubtitlesToSpecificLanguage("ru")