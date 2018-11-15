docker build --no-cache -t zamza:test .
docker run -it --rm -p 1912:191 --name zamzatest zamza:test