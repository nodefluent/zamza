FROM node:10.11
RUN yarn global add zamza
ADD bin/docker.json /opt/docker.json
CMD ["zamza", "-p", "1912", "-l", "/opt/docker.json"]