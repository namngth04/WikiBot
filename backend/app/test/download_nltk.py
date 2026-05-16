import nltk

def download_nltk_resources():
    resources = [
        'punkt',
        'punkt_tab',
        'averaged_perceptron_tagger_eng',
        'maxent_ne_chunker',
        'words',
        'stopwords'
    ]
    for res in resources:
        print(f"Downloading {res}...")
        nltk.download(res)

if __name__ == "__main__":
    download_nltk_resources()
