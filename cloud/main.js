String.prototype.isEmpty = function () {
    return (this.length === 0 || !this.trim());
};

Parse.Object.prototype.isEmptyProperty = function(property) {
    return  this.get(property) == undefined || this.get(property).isEmpty();
}

Parse.Cloud.beforeSave("Abuse", function (request, response) {
    if (!request.object.isNew()) {
        return response.success();
    }

    new Parse.Query("Item").get(request.object.get("item").id, {
        success: function (item) {
            item.set("abuseReported", true);
            console.log("Abuse reported");
            item.save();
            var subject = "Abuse reported";
            var message = "New Abuse reported for item: " + request.object.get("item").id;
            var receivers = []
            var receiversConfig = Parse.Config.get("abuseReceivers");
            for (var i = 0; i < receiversConfig.length; i+=2) {
                receivers.push({email: receiversConfig[i], name: receiversConfig[i+1]});
            }

            sendEmail(subject, message, receivers, "abuse@maybe.xyz", "Abuse Reporter", function () {
                response.success();
            });
        },
        error: function (error) {
            console.error("Got an error " + error.code + " : " + error.message);
            response.error("Didn't mark as abused");
        }
    });
});

Parse.Cloud.afterSave("Comment", function (request) {
    Parse.Cloud.useMasterKey();
    if (!request.object.existed()) {
        request.object.get("basket").fetch({
            success: function (basket) {
                basket.increment("comments");
                basket.set("lastCommentAddedAt", new Date());
                basket.save();
            },
            error: function (error) {
                console.error("Error fetching data for basket " + basket.id);
                console.error(error);
            }
        });

        request.object.get("item").fetch({
            success: function (item) {
                item.increment("comments");
                item.save();
            },
            error: function (error) {
                console.error("Error fetching data for item " + item.id);
                console.error(error);
            }
        });

    }

    new Parse.Query("Item").get(request.object.get("item").id, {
        success: function (item) {
            var commenterId = request.object.get("voter").id;
            var itemShopperId = item.get("shopper").id;
            if (commenterId == itemShopperId) {
                notifyComentators(request.object);
                return;
            }

            var alert = "New comment for the item: " + request.object.get("body");

            if (!item.isEmptyProperty("title")) {
                alert = "New comment for the item '" + item.get("title") + "': " + request.object.get("body");
            } else if (!item.isEmptyProperty("context")) {
                alert = "New comment for the item '" + item.get("context") + "': " + request.object.get("body");
            }
            
            notifyBasketOwner(request.object.get("basket").id, {alert: alert});
        },
        error: function (error) {
            console.error("Failed to query for item " + error)
        }
    });
});

Parse.Cloud.afterDelete("Comment", function (request) {
    Parse.Cloud.useMasterKey();
    request.object.get("basket").fetch({
        success: function (basket) {
            basket.increment("comments", -1);
            basket.save();
        },
        error: function (error) {
            console.error("Error fetching data for basket " + basket.id);
            console.error(error);
        }
    });

    request.object.get("item").fetch({
        success: function (item) {
            item.increment("comments", -1);
            item.save();
        },
        error: function (error) {
            console.error("Error fetching data for item " + item.id);
            console.error(error);
        }
    });
});

Parse.Cloud.afterSave("Vote", function (request) {
    Parse.Cloud.useMasterKey();
    if (!request.object.existed()) {
        new Parse.Query("Item").get(request.object.get("item").id, {
            success: function (item) {
                var voterId = request.object.get("voter").id;
                var itemShopperId = item.get("shopper").id;
                if (voterId != itemShopperId) {
                    var alert = "New vote for the item";

                    if (!item.isEmptyProperty("title")) {
                        alert = "New vote for the item '" + item.get("title") + "'";
                    } else if (!item.isEmptyProperty("context")) {
                        alert = "New vote for the item '" + item.get("context") + "'";
                    }
                    notifyBasketOwner(request.object.get("basket").id, {alert: alert});
                }

                if (request.object.get("vote") == true) {
                    item.increment("likes");
                } else {
                    item.increment("dislikes");
                }

                item.save();                
            },
            error: function (error) {
                console.error("Failed to query for item " + request.object.get("item").id);
            }
        });
    }
});

Parse.Cloud.afterDelete("Vote", function (request) {
    Parse.Cloud.useMasterKey();
    new Parse.Query("Item").get(request.object.get("item").id, {
        success: function (item) {
            if (request.object.get("vote") == true) {
                item.increment("likes", -1);
            } else {
                item.increment("dislikes", -1);
            }

            item.save();
        },
        error: function (error) {
            console.error("Failed to query for item " + request.object.get("item").id);
        }
    });
});

Parse.Cloud.afterSave("Item", function (request) {
    Parse.Cloud.useMasterKey();

    var itemBasket = request.object.get("basket");
    if (itemBasket != null) {
        itemBasket.fetch({
            success: function (basket) {
                updateBasketInfo(basket, null);
            },
            error: function (error) {
                console.error("Fetching data for item " + request.object.id + " basket failed.");
                console.error(error);
            }
        });
    }
});

Parse.Cloud.afterDelete("Item", function (request) {
    Parse.Cloud.useMasterKey();

    request.object.get("basket").fetch({
        success: function (basket) {
            updateBasketInfo(basket, null);
        },
        error: function (error) {
            console.error("Fetching data for item " + request.object.id + " basket failed.");
            console.error(error);
        }
    });
});

Parse.Cloud.afterSave("ItemSuggestion", function(request) {
    Parse.Cloud.useMasterKey();

    request.object.get("suggestedBy").fetch({
        success: function(basket) {
            updateSuggestionBasketInfo(basket);
        },
        error: function (error) {
            console.error("Fetching data for item suggestion " + request.object.id + " suggestedBy basket failed.");
            console.error(error);
        }
    });

    request.object.get("suggestedTo").fetch({
        success: function(basket) {
            updateSuggestionBasketInfo(basket);

            if (!request.object.existed()) {
                var alertMessage = "You have received an item suggestion!";
                var type = "Suggestion";
                pushToUser(basket.get("shopper").id, {alert: alertMessage, type: type});
            }
        },
        error: function (error) {
            console.error("Fetching data for item suggestion " + request.object.id + " suggestedTo basket failed.");
            console.error(error);
        }
    });
});

Parse.Cloud.afterDelete("ItemSuggestion", function(request) {
    Parse.Cloud.useMasterKey();

    if (request.object.get("status") != "Accepted") {
        request.object.get("item").fetch({
            success: function(item) {
                item.destroy();
            },
            error: function(error) {
                console.error("Fetching item for item suggestion " + request.object.id + " failed.");
                console.error(error);
            }
        });
    }

    request.object.get("suggestedBy").fetch({
        success: function(basket) {
            updateSuggestionBasketInfo(basket);
        },
        error: function (error) {
            console.error("Fetching data for item suggestion " + request.object.id + " suggestedBy basket failed.");
            console.error(error);
        }
    });

    request.object.get("suggestedTo").fetch({
        success: function(basket) {
            updateSuggestionBasketInfo(basket);
        },
        error: function (error) {
            console.error("Fetching data for item suggestion " + request.object.id + " suggestedTo basket failed.");
            console.error(error);
        }
    });
});

Parse.Cloud.define("updateBasket", function(request, response) {
    var basketId = request.params.basket;
    new Parse.Query("Basket").get(basketId, {
        success: function(basket) {
            updateBasketInfo(basket, function(success) {
                if (success) {
                    response.success();
                } else {
                    response.error("Updating basket info failed.");
                }
            });
        },
        error: function(error) {
            console.error("Failed to query for basket " + basketId + " to update " + error);
            response.error(error);
        }
    });
});

Parse.Cloud.define("createSuggestionBasket", function(request, response) {
    Parse.Cloud.useMasterKey();
    var shopperId = request.params.shopper;
    new Parse.Query("_User").get(shopperId, {
        success: function(shopper) {

            var Basket = Parse.Object.extend("Basket");
            var suggestionBasket = new Basket();
            suggestionBasket.set("shopper", shopper);
            suggestionBasket.set("name", "Suggestions");
            suggestionBasket.set("context", "Things suggested to me by friends and my suggestions to friends.");
            suggestionBasket.set("privacy", "Secret");

            var acl = new Parse.ACL();
            acl.setPublicReadAccess(true);
            acl.setWriteAccess(shopper, true);
            suggestionBasket.set("ACL", acl);

            suggestionBasket.save(null, {
                success: function(basket) {
                    shopper.set("suggestionBasket", basket);
                    shopper.save(null, {
                        success: function(shopper) {
                            console.log("Created suggestion basket for shopper " + shopperId);
                            response.success(basket.id);
                        },
                        error: function(error) {
                            console.error("Failed to save shopper " + shopperId + " when creating suggestion basket: " + error);
                            suggestionBasket.destroy();
                            response.error("Failed to save shopper.");
                        }
                    });
                },
                error: function(error) {
                    console.error("Failed to save suggestion basket for shopper " + shopperId);
                    console.error(error);
                    response.error("Failed to save suggestion basket.");
                }
            });
        },
        error: function(error) {
            console.error("Failed to query for user " + shopperId + ": " + error);
            response.error("Failed to query for user.");
        }
    });
});

Parse.Cloud.define("changeVote", function(request, response) {
    Parse.Cloud.useMasterKey();
    var voteId = request.params.vote;
    new Parse.Query("Vote").get(voteId, {
        success: function (vote) {

            new Parse.Query("Item").get(vote.get("item").id, {
                success: function(item) {
                    if (vote.get("vote") == true) {
                        item.increment("likes");
                        item.increment("dislikes", -1);
                    } else {
                        item.increment("dislikes");
                        item.increment("likes", -1);
                    }

                    item.save();
                    response.success();
                },
                error: function (error) {
                    console.error("Failed to query for vote " + voteId);
                    response.error(error);
                }
            });
        },
        error: function (error) {
            console.error("Failed to query for item " + request.object.get("item").id);
            response.error(error);
        }
    });
});

Parse.Cloud.define("hello", function(request, response) {
    console.log('test');
    response.success({status: 'success'});
});

updateBasketInfo = function (basket, completion) {
    var itemsQuery = new Parse.Query("Item");
    itemsQuery.equalTo("basket", basket);
    itemsQuery.notEqualTo("softDeleted", true);
    itemsQuery.descending("createdAt");

    itemsQuery.find({
        success: function (itemResults) {
            basket.set("itemCount", itemResults.length);
            if (itemResults.length == 0) {
                basket.set("latestItem", null);
                basket.set("lastItemAddedAt", null);
            } else {
                basket.set("latestItem", itemResults[0]);
                basket.set("lastItemAddedAt", itemResults[0]["createdAt"]);
            }
            basket.save();

            var commentsQuery = new Parse.Query("Comment");
            commentsQuery.containedIn("item", itemResults);
            commentsQuery.descending("createdAt");
            commentsQuery.find({
                success: function (commentResults) {
                    basket.set("comments", commentResults.length);
                    if (commentResults.length > 0) {
                        basket.set("lastCommentAddedAt", commentResults[0]["createdAt"]);
                    } else {
                        basket.set("lastCommentAddedAt", null);
                    }
                    basket.save();

                    var voteQuery = new Parse.Query("Vote");
                    voteQuery.containedIn("item", itemResults);
                    voteQuery.descending("updatedAt");
                    voteQuery.find({
                        success: function (voteResults) {
                            if (voteResults.length > 0) {
                                basket.set("lastVoteAddedAt", voteResults[0]["updatedAt"]);
                            } else {
                                basket.set("lastVoteAddedAt", null);
                            }
                            basket.save();
                            if (completion != null) { completion(true); }
                        },
                        error: function (error) {
                            console.error("Failed to get votes for basket " + basket.id);
                            console.error(error);
                            if (completion != null) { completion(false); }
                        }
                    });
                },
                error: function (error) {
                    console.error("Failed to get comments for basket " + basket.id);
                    console.error(error);
                    if (completion != null) { completion(false); }
                }
            });
        },
        error: function (error) {
            console.error("Query for items in basket " + basket.id + "failed.");
            console.error(error);
            if (completion != null) { completion(false); }
        }
    });
};

updateSuggestionBasketInfo = function(basket) {
    var suggestedByQuery = new Parse.Query("ItemSuggestion");
    suggestedByQuery.equalTo("suggestedBy", basket);
    var suggestedToQuery = new Parse.Query("ItemSuggestion");
    suggestedToQuery.equalTo("suggestedTo", basket);

    var itemSuggestionsQuery = new Parse.Query.or(suggestedByQuery, suggestedToQuery);
    itemSuggestionsQuery.equalTo("status", "Suggested");
    itemSuggestionsQuery.include("item");
    itemSuggestionsQuery.descending("createdAt");

    itemSuggestionsQuery.find({
        success: function (suggestionResults) {
            basket.set("itemCount", suggestionResults.length);
            if (suggestionResults.length == 0) {
                basket.set("latestItem", null);
                basket.set("lastItemAddedAt", null);
            } else {
                basket.set("latestItem", suggestionResults[0].get("item"));
                basket.set("lastItemAddedAt", suggestionResults[0]["createdAt"]);
            }
            basket.save();
        },
        error: function (error) {
            console.error("Query for item suggestions in basket " + basket.id + " failed.");
            console.error(error);
        }
    });
};

notifyBasketOwner = function (basketId, data) {
    var basketQuery = new Parse.Query("Basket");
    basketQuery.equalTo("objectId", basketId);
    basketQuery.include("shopper");
    basketQuery.find({
        success: function (results) {
            pushToUser(results[0].get("shopper").id, data);
        },
        error: function (error) {
            console.error("Failed to query for basket")
        }
    });
};

pushToUser = function (userId, data) {
    console.log('pushing to user: ' + userId);
    
    var userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo("objectId", userId);

    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.exists("user");
    pushQuery.include("user");
    pushQuery.matchesQuery("user", userQuery);

    Parse.Push.send({
        where: pushQuery,
        data: data
    }, { useMasterKey: true})
    .then(
      function () {
        console.log("Push notification was sent successfully");
      },
      function (error) {
        console.error("Push notification failed with error:");
        console.error(error);
        // throw "Got an error " + error.code + " : " + error.message;
      }
    );
};

notifyComentators = function (comment) {
    var commentQuery = new Parse.Query("Comment");
    commentQuery.equalTo("item", comment.get("item"));
    commentQuery.include("voter");
    commentQuery.descending("createdAt");
    commentQuery.find({
        success: function (results) {
            var ownerFullName = "";
            var usersEmails = [], tmp = {};
            for (var j = 0; j < results.length; j++) {
                if (results[j].createdAt < comment.createdAt) {
                    if(results[j].get("voter").id == comment.get("voter").id) {
                        break;
                    } else {
                        var voter = results[j].get("voter");

                        if(tmp.hasOwnProperty(voter.id)) {
                            console.log("Reapeted User");
                            continue;
                        }
                        if (voter.isEmptyProperty("username")) {
                            console.log("Missing email address");
                            continue;
                        }
                        var fullName = voter.get("firstname") + " " + voter.get("lastname");
                        
                        usersEmails.push({email:voter.get("username"), name:fullName});
                        tmp[voter.id] = 1;
                        console.log("Sending email to " + voter.get("username") + " - " + fullName);

                    }
                } else if(comment.id == results[j].id) {
                    ownerFullName = results[j].get("voter").get("firstname") + " " + results[j].get("voter").get("lastname");
                }
            }
            var url = "https://m.maybe.xyz/" + comment.get("basket").id + "/comments/" + comment.get("item").id;
            var subject = ownerFullName + " has replied to a conversation you were in";
            var message = ownerFullName + " has added a new comment, please come back to see details\n" + url + "\nThanks,\n" + ownerFullName;

            if(usersEmails.length > 0) {
                sendEmail(subject, message, usersEmails, Parse.Config.get("sendEmail"), "Maybe.xyz", function () {});
            } else {
                console.log("No Emails to sent");
            }
        },
        error: function (error) {
            console.error("Failed to query for Comments");
        }
    });
};

sendEmail = function (subject, message, users, fromEmail, fromName, callback) {
    var Mandrill = require("mandrill");
    Mandrill.initialize(Parse.Config.get("mandrillKey"));

    Mandrill.sendEmail({
        message: {
            text: message,
            subject: subject,
            from_email: fromEmail,
            from_name: fromName,
            to: users
        },
        async: false
    }, {
        success: function (httpResponse) {
            console.log("Email sent successfully");
            callback();
        },
        error: function (httpResponse) {
            console.error("Send email failed");
            console.error(httpResponse);
            callback();
        }
    });
};
